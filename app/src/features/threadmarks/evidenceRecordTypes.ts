export type EvidenceRecordStatus = 'active' | 'orphaned';

export type EvidenceRecordAnchorContext = {
  prefix: string;
  suffix: string;
};

export type EvidenceRecord = {
  id: string;
  caseId: string;
  originDossierId: string;
  originSectionId: string;
  targetDossierId: string;
  selectedText: string;
  anchorStart: number;
  anchorEnd: number;
  anchorContext: EvidenceRecordAnchorContext;
  metadata: Record<string, unknown>;
  status: EvidenceRecordStatus;
  createdAt: string;
  updatedAt: string;
};
