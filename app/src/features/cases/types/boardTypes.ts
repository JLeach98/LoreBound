export type BoardPinPosition = {
  x: number;
  y: number;
};

export type BoardPin = {
  id: string;
  caseId: string;
  dossierId: string;
  order: number;
  position: BoardPinPosition;
  datePinned: string;
};
