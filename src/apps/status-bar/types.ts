export type StatusBarStats = {
  total: number;
  mastered: number;
  mature: number;
  young: number;
  blacklisted: number;
  new: number;
  due: number;
};

export type StatusBarButton = {
  id: string;
  icon: string;
  tooltip: string;
  handler: () => void;
};
