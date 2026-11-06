-- set_enquiry_status wiped contract_value_aed, referral_fee_aed and
-- fee_paid_at whenever a signed deal moved to any other status, with no
-- check, so one mis-tap on "Lost" erased a signed (even paid) deal's money
-- record. Re-saving "signed" also recomputed the fee from the residence's
-- CURRENT percentage, contradicting the "snapshotted at signing" rule.
--
-- Now:
--  * A signed deal whose fee is marked paid cannot change status until it
--    is marked unpaid first.
--  * Re-saving a signed deal keeps the percentage it was signed at (the
--    fee is recomputed from that rate only if the contract value changes),
--    and a paid deal's contract value can't be changed.
--  * Leaving 'signed' while unpaid is still allowed (a deal can fall
--    through); the app asks for confirmation first.
create or replace function public.set_enquiry_status(
  enquiry_id_input uuid,
  status_input text,
  contract_value_input numeric default null
)
returns housing_enquiries
language plpgsql
security definer set search_path = public
as $$
declare
  enquiry housing_enquiries%rowtype;
  fee_percent numeric;
  new_fee numeric;
begin
  if not public.is_admin() then
    raise exception 'Only the Havenly team can update enquiries.';
  end if;
  if status_input not in ('new', 'contacted', 'viewing_booked', 'signed', 'lost') then
    raise exception 'Unknown status: %', status_input;
  end if;

  select * into enquiry from housing_enquiries where id = enquiry_id_input;
  if enquiry.id is null then
    raise exception 'This enquiry no longer exists.';
  end if;

  if status_input = 'signed' then
    if contract_value_input is null or contract_value_input <= 0 then
      raise exception 'Enter the contract value to mark this as signed.';
    end if;

    if enquiry.status = 'signed' and enquiry.referral_fee_aed is not null and enquiry.contract_value_aed is not null then
      -- Already signed: keep the fee as snapshotted unless the contract
      -- value itself changed, and then only at the rate it was signed at.
      if contract_value_input = enquiry.contract_value_aed then
        new_fee := enquiry.referral_fee_aed;
      else
        if enquiry.fee_paid_at is not null then
          raise exception 'This deal''s fee is marked as paid, so its contract value can''t be changed. Mark the fee as unpaid first.';
        end if;
        new_fee := round(contract_value_input * enquiry.referral_fee_aed / enquiry.contract_value_aed, 2);
      end if;
    else
      select referral_fee_percent into fee_percent from residence_partner_terms where residence_id = enquiry.residence_id;
      if fee_percent is null then
        raise exception 'Set this residence''s referral fee percentage first.';
      end if;
      new_fee := round(contract_value_input * fee_percent / 100, 2);
    end if;

    update housing_enquiries set
      status = 'signed',
      contract_value_aed = contract_value_input,
      referral_fee_aed = new_fee,
      status_updated_at = now()
    where id = enquiry_id_input
    returning * into enquiry;
  else
    if enquiry.status = 'signed' and enquiry.fee_paid_at is not null then
      raise exception 'This deal is signed and its fee is marked as paid. Mark the fee as unpaid before changing the status.';
    end if;
    update housing_enquiries set
      status = status_input,
      contract_value_aed = null,
      referral_fee_aed = null,
      fee_paid_at = null,
      status_updated_at = now()
    where id = enquiry_id_input
    returning * into enquiry;
  end if;

  return enquiry;
end;
$$;
grant execute on function public.set_enquiry_status(uuid, text, numeric) to authenticated;
