import { describe, it, expect } from 'vitest';
import { chatBubbleText } from './chatMessage';
import { HOUSING_NOTIFICATION_TYPES } from '../lib/notificationTypes';

describe('old data from the archived social features', () => {
  it('shows a plain line for a message that shared a post', () => {
    expect(chatBubbleText({ body: '', shared_post_id: 'p1' })).toBe('Shared a post (no longer available)');
  });
  it('shows the text of a normal message', () => {
    expect(chatBubbleText({ body: 'Is it still free?', shared_post_id: null })).toBe('Is it still free?');
    expect(chatBubbleText({ body: 'Hi' })).toBe('Hi');
  });
  it('only lists housing notifications', () => {
    expect([...HOUSING_NOTIFICATION_TYPES]).toEqual(['enquiry_new', 'enquiry_status']);
  });
});
