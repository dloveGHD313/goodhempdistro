export type CategoryGroup =
  | "industrial"
  | "recreational"
  | "convenience"
  | "food";

export type Category = {
  id: string;
  name: string;
  group: CategoryGroup;
};
