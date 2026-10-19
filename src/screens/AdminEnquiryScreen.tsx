import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Linking } from 'react-native';
import { useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { ADMIN_STATUS_LABEL, ENQUIRY_STATUSES, formatAed, formatMonth, PERIOD_LABEL } from '@/lib/housing';
import { timeAgo } from '@/utils/timeAgo';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import Skeleton from '@/components/Skeleton';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { EnquiryStatus, HousingEnquiry, ResidencePartnerTerms } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'AdminEnquiry'>;

export default function AdminEnquiryScreen() {
  const route = useRoute<Route>();
  const { enquiryId } = route.params;
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [enquiry, setEnquiry] = useState<HousingEnquiry | null>(null);
  const [terms, setTerms] = useState<ResidencePartnerTerms | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<EnquiryStatus | null>(null);
  const [contractValue, setContractValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('housing_enquiries')
      .select('*, user:profiles(id, display_name, username, avatar_url, university), residence:residences(id, name, area, photo_urls, provider_name), room_type:room_types(id, name, price_aed, billing_period)')
      .eq('id', enquiryId).maybeSingle();
    const row = data as unknown as HousingEnquiry | null;
    setEnquiry(row);
    if (row) {
      const { data: termRow } = await supabase.from('residence_partner_terms').select('*').eq('residence_id', row.residence_id).maybeSingle();
      setTerms(termRow as ResidencePartnerTerms | null);
      setContractValue(row.contract_value_aed != null ? String(Number(row.contract_value_aed)) : '');
    }
    setLoaded(true);
  }, [enquiryId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const selectedStatus = pendingStatus ?? enquiry?.status ?? 'new';
  const parsedContract = Number(contractValue.replace(/[^\d.]/g, ''));
  const feePreview = terms && Number.isFinite(parsedContract) && parsedContract > 0
    ? (parsedContract * Number(terms.referral_fee_percent)) / 100
    : null;

  const saveStatus = async () => {
    if (!enquiry) return;
    if (selectedStatus === 'signed' && !(parsedContract > 0)) {
      showToast('Enter the contract value first', 'error');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc('set_enquiry_status', {
      enquiry_id_input: enquiry.id,
      status_input: selectedStatus,
      contract_value_input: selectedStatus === 'signed' ? parsedContract : null,
    });
    setSaving(false);
    if (error) {
      showToast(error.message || 'Couldn’t update this enquiry', 'error');
      return;
    }
    haptics.success();
    setEnquiry((prev) => (prev ? { ...prev, ...(data as HousingEnquiry) } : prev));
    setPendingStatus(null);
    showToast(`Marked as ${ADMIN_STATUS_LABEL[selectedStatus].toLowerCase()}`, 'success');
  };

  const togglePaid = async () => {
    if (!enquiry) return;
    const { data, error } = await supabase.rpc('set_referral_fee_paid', { enquiry_id_input: enquiry.id, paid: !enquiry.fee_paid_at });
    if (error) {
      showToast(error.message || 'Couldn’t update payment', 'error');
      return;
    }
    haptics.success();
    setEnquiry((prev) => (prev ? { ...prev, ...(data as HousingEnquiry) } : prev));
  };

  const phoneDigits = (enquiry?.contact_phone ?? '').replace(/[^\d]/g, '');

  const leadSummary = enquiry ? [
    `New Havenly student enquiry for ${enquiry.residence?.name ?? 'your residence'}`,
    `Student: ${enquiry.user?.display_name ?? 'Deleted account'}${enquiry.user?.university ? ` (${enquiry.user.university})` : ''}`,
    enquiry.contact_phone ? `Phone: ${enquiry.contact_phone}` : null,
    `Type: ${enquiry.kind === 'viewing' ? 'Viewing request' : 'Question'}`,
    enquiry.room_type ? `Room: ${enquiry.room_type.name}` : null,
    `Move-in: ${formatMonth(enquiry.move_in_month)} for ${enquiry.duration_months} months`,
    enquiry.budget_aed ? `Budget: ${formatAed(enquiry.budget_aed)} / year` : null,
    enquiry.preferred_viewing ? `Free for viewing: ${enquiry.preferred_viewing}` : null,
    enquiry.message ? `Message: ${enquiry.message}` : null,
  ].filter(Boolean).join('\n') : '';

  const copyLead = async () => {
    await Clipboard.setStringAsync(leadSummary);
    haptics.success();
    showToast('Lead copied — paste it to the residence', 'success');
  };

  if (!loaded) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
          <Text style={styles.title}>Enquiry</Text>
        </View>
        <View style={{ padding: spacing.lg, gap: 10 }}>
          <Skeleton style={{ height: 90, borderRadius: radius.md }} />
          <Skeleton style={{ height: 140, borderRadius: radius.md }} />
        </View>
      </View>
    );
  }

  if (!enquiry) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
          <Text style={styles.title}>Enquiry</Text>
        </View>
        <Text style={styles.muted}>This enquiry no longer exists.</Text>
      </View>
    );
  }

  const statusDirty = selectedStatus !== enquiry.status
    || (selectedStatus === 'signed' && (parsedContract || 0) !== Number(enquiry.contract_value_aed ?? 0));

  const detail = (label: string, value: string | null | undefined) => (value ? (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  ) : null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
        <Text style={styles.title}>Enquiry</Text>
        <Text style={styles.headerTime}>{timeAgo(enquiry.created_at)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Student</Text>
        {enquiry.user ? (
          <>
            <Text style={styles.bigName}>{enquiry.user.display_name}</Text>
            <Text style={styles.muted2}>@{enquiry.user.username}{enquiry.user.university ? ` · ${enquiry.user.university}` : ''}</Text>
          </>
        ) : (
          <>
            <Text style={styles.bigName}>Deleted account</Text>
            <Text style={styles.muted2}>The student deleted their account. This signed deal is kept so the fee can still be invoiced.</Text>
          </>
        )}
        {enquiry.contact_phone ? (
          <>
            <Text style={styles.phone}>{enquiry.contact_phone}</Text>
            <View style={styles.actionRow}>
              <AnimatedPressable style={styles.actionBtn} onPress={() => Linking.openURL(`https://wa.me/${phoneDigits}`)}>
                <Icon name="message-circle" size={14} color={colors.ink} />
                <Text style={styles.actionText}>WhatsApp</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${enquiry.contact_phone?.replace(/\s/g, '')}`)}>
                <Icon name="phone" size={14} color={colors.ink} />
                <Text style={styles.actionText}>Call</Text>
              </AnimatedPressable>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Request</Text>
        {detail('Residence', enquiry.residence?.name)}
        {detail('Type', enquiry.kind === 'viewing' ? 'Viewing request' : 'Question')}
        {detail('Room', enquiry.room_type ? `${enquiry.room_type.name} · ${formatAed(enquiry.room_type.price_aed)}/${PERIOD_LABEL[enquiry.room_type.billing_period]}` : 'Not sure yet')}
        {detail('Move-in', `${formatMonth(enquiry.move_in_month)} · ${enquiry.duration_months} months`)}
        {detail('Budget', enquiry.budget_aed ? `${formatAed(enquiry.budget_aed)} / year` : null)}
        {detail('Viewing', enquiry.preferred_viewing)}
        {enquiry.message ? <Text style={styles.message}>“{enquiry.message}”</Text> : null}
        <AnimatedPressable style={styles.copyBtn} onPress={copyLead}>
          <Icon name="copy" size={14} color={colors.sand} />
          <Text style={styles.copyBtnText}>Copy lead for the residence</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Partner</Text>
        <Text style={styles.partnerName}>{enquiry.residence?.provider_name}</Text>
        {terms ? (
          <>
            {detail('Contact', terms.contact_name)}
            {detail('Email', terms.contact_email)}
            {detail('Phone', terms.contact_phone)}
            {detail('Referral fee', `${Number(terms.referral_fee_percent)}% of contract value`)}
          </>
        ) : (
          <Text style={styles.warn}>No referral fee set for this residence — add one in its listing before marking a deal as signed.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Status</Text>
        <View style={styles.chipGrid}>
          {ENQUIRY_STATUSES.map((s) => {
            const selected = selectedStatus === s;
            return (
              <AnimatedPressable key={s} style={[styles.chip, selected && styles.chipSelected]} onPress={() => { haptics.tap(); setPendingStatus(s); }}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{ADMIN_STATUS_LABEL[s]}</Text>
              </AnimatedPressable>
            );
          })}
        </View>

        {selectedStatus === 'signed' && (
          <>
            <Text style={styles.inputLabel}>Contract value (AED, whole contract)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 42000"
              placeholderTextColor={colors.inkSoft}
              value={contractValue}
              onChangeText={setContractValue}
              keyboardType="decimal-pad"
            />
            {feePreview != null && (
              <Text style={styles.feePreview}>Havenly’s fee: {formatAed(feePreview)} ({Number(terms?.referral_fee_percent)}%)</Text>
            )}
          </>
        )}

        {statusDirty ? (
          <AnimatedPressable style={styles.saveBtn} onPress={saveStatus} disabled={saving}>
            {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Save status</Text>}
          </AnimatedPressable>
        ) : null}

        {enquiry.status === 'signed' && enquiry.referral_fee_aed != null && (
          <View style={styles.feeBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.feeAmount}>{formatAed(Number(enquiry.referral_fee_aed))}</Text>
              <Text style={styles.muted2}>
                {enquiry.fee_paid_at ? `Paid ${timeAgo(enquiry.fee_paid_at)}` : 'Owed by the residence'}
              </Text>
            </View>
            <AnimatedPressable style={[styles.paidBtn, !!enquiry.fee_paid_at && styles.paidBtnActive]} onPress={togglePaid}>
              <Icon name={enquiry.fee_paid_at ? 'check-circle' : 'circle'} size={14} color={enquiry.fee_paid_at ? colors.teal : colors.ink} />
              <Text style={styles.paidBtnText}>{enquiry.fee_paid_at ? 'Paid' : 'Mark paid'}</Text>
            </AnimatedPressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 12, paddingHorizontal: spacing.lg },
    back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
    headerTime: { fontSize: 12, color: colors.inkSoft },
    muted: { color: colors.inkSoft, textAlign: 'center', marginTop: 80 },
    muted2: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
    card: {
      marginHorizontal: spacing.lg, marginBottom: 12, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.line, borderRadius: radius.md, padding: 14,
    },
    cardLabel: {
      fontFamily: 'JetBrainsMono_500Medium', fontSize: 10.5, textTransform: 'uppercase', color: colors.inkSoft, marginBottom: 8,
    },
    bigName: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
    phone: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: 10, fontVariant: ['tabular-nums'] },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.line,
    },
    actionText: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
    detailRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
    detailLabel: { width: 82, fontSize: 12.5, color: colors.inkSoft },
    detailValue: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.ink },
    message: { fontSize: 13, color: colors.ink, lineHeight: 19, marginTop: 8, fontStyle: 'italic' },
    copyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.ink,
      paddingVertical: 11, borderRadius: radius.button, marginTop: 14,
    },
    copyBtnText: { color: colors.sand, fontWeight: '700', fontSize: 13 },
    partnerName: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 4 },
    warn: { fontSize: 12.5, color: colors.coral, lineHeight: 18 },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
    chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
    chipTextSelected: { color: colors.sand },
    inputLabel: { fontSize: 12, color: colors.inkSoft, marginTop: 14, marginBottom: 6 },
    input: {
      backgroundColor: colors.sand, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
      padding: 12, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'],
    },
    feePreview: { fontSize: 12.5, fontWeight: '700', color: colors.teal, marginTop: 8 },
    saveBtn: { marginTop: 14, backgroundColor: colors.coral, paddingVertical: 12, borderRadius: radius.button, alignItems: 'center' },
    saveBtnText: { color: 'white', fontWeight: '700', fontSize: 13.5 },
    feeBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14,
      borderTopWidth: 1, borderColor: colors.line,
    },
    feeAmount: { fontSize: 20, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
    paidBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.line,
    },
    paidBtnActive: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
    paidBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  });
}
