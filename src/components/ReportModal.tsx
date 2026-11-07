// Pick a reason, then write reports/{id}. Reuses SelectModal.
import React from 'react';
import { Alert } from 'react-native';
import SelectModal from './SelectModal';
import { REPORT_REASONS, createReport } from '../services/moderationApi';

export interface ReportTarget {
  circleId?: string | null;
  messageId?: string | null;
  postId?: string | null;
}

interface Props {
  target: ReportTarget | null; // null hides the modal
  reporterId?: string | null;
  onClose: () => void;
}

export default function ReportModal({ target, reporterId, onClose }: Props) {
  const title = target?.messageId ? 'Report message' : target?.postId ? 'Report post' : 'Report circle';
  const onSelect = async (reason: string) => {
    if (!target || !reporterId) {
      Alert.alert('Not signed in', 'Please sign in again to report.');
      return;
    }
    try {
      await createReport(target, reporterId, reason);
      Alert.alert('Thanks for reporting', 'Our moderators will review it.');
    } catch (e: any) {
      Alert.alert('Report failed', e?.message || 'Please try again.');
    }
  };
  return (
    <SelectModal
      visible={!!target}
      title={title}
      options={REPORT_REASONS}
      selected={null}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
