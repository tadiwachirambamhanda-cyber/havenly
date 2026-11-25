import { describe, it, expect } from 'vitest';
import { canSendGroup, cleanCode, codeProblem, eachPersonLine, groupErrorMessage, groupStatusLine, phoneProblem, shareMessage } from './groupEnquiry';
import { splitRent } from './rentSplit';

describe('codes', () => {
  it('cleans what was typed', () => {
    expect(cleanCode(' ab c-d2e ')).toBe('ABCD2E');
    expect(cleanCode('wsdfsh')).toBe('WSDFSH');
  });
  it('accepts a valid code', () => expect(codeProblem('wsd-fsh')).toBeNull());
  it('asks for a code when empty', () => expect(codeProblem('   ')).toMatch(/Type the 6-character code/));
  it('refuses the wrong length', () => {
    expect(codeProblem('ABC')).toMatch(/6 characters/);
    expect(codeProblem('ABCDEFG')).toMatch(/6 characters/);
  });
  it('refuses characters the codes never use (I, O, 0, 1)', () => {
    for (const bad of ['ABCDE0', 'ABCDE1', 'ABCDEO', 'ABCDEI']) expect(codeProblem(bad), bad).toMatch(/does not look like/);
  });
});

describe('phone', () => {
  it('accepts normal numbers', () => {
    expect(phoneProblem('+971 50 123 4567')).toBeNull();
    expect(phoneProblem('050-123-4567')).toBeNull();
  });
  it('refuses short, long or text', () => {
    for (const bad of ['', '12345', 'call me', '+971 50 123 4567 8901 2345 678']) expect(phoneProblem(bad), bad).not.toBeNull();
  });
});

describe('group size and wording', () => {
  it('can send from 2 to 8 people', () => {
    expect(canSendGroup(1)).toBe(false);
    expect(canSendGroup(2)).toBe(true);
    expect(canSendGroup(8)).toBe(true);
    expect(canSendGroup(9)).toBe(false);
  });
  it('shows each person\'s share from the rent split (the design example)', () => {
    const split = splitRent({ rentAed: 9000, bills: { kind: 'range', minAed: 450, maxAed: 700 }, people: 3 });
    expect(eachPersonLine(split, 3)).toBe('About AED 3,150 to 3,233 each a month');
  });
  it('gives a hint while the group is one person, and a message when the price is missing', () => {
    expect(eachPersonLine(null, 1)).toMatch(/Share the code/);
    expect(eachPersonLine(null, 3)).toMatch(/cannot work out/);
  });
  it('says where the group stands', () => {
    expect(groupStatusLine('open', true, 'Sam', 1)).toMatch(/Waiting for friends/);
    expect(groupStatusLine('open', true, 'Sam', 3)).toMatch(/Ready to send/);
    expect(groupStatusLine('open', false, 'Sam', 3)).toBe('Waiting for Sam to send the enquiry.');
    expect(groupStatusLine('sent', false, 'Sam', 3)).toMatch(/sent to the Havenly team/);
    expect(groupStatusLine('closed', true, 'Sam', 1)).toMatch(/closed/);
  });
  it('the share message contains the code and the home', () => {
    const m = shareMessage('WSDFSH', 'Sample Home, JLT');
    expect(m).toContain('WSDFSH');
    expect(m).toContain('Sample Home, JLT');
  });
});

describe('groupErrorMessage', () => {
  it('passes the database\'s plain messages through', () => {
    expect(groupErrorMessage({ message: 'That code does not match a group.' }, 'x')).toBe('That code does not match a group.');
    expect(groupErrorMessage({ message: 'This group is full (8 people).' }, 'x')).toBe('This group is full (8 people).');
  });
  it('hides anything technical', () => {
    expect(groupErrorMessage({ message: 'duplicate key value violates unique constraint' }, 'Try again.')).toBe('Try again.');
    expect(groupErrorMessage(null, 'Try again.')).toBe('Try again.');
  });
});
