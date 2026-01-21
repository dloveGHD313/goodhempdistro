export type CategoryGroup =
  | "industrial"
  | "recreational"
  | "convenience"
  | "food";

export type CategoryType = "product" | "service";

export type Category = {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  requires_coa: boolean;
  category_type: CategoryType;
  group: CategoryGroup;
};
