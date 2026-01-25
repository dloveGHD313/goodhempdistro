import { permanentRedirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LegacyProductRedirect(props: Props) {
  const params = await props.params;
  permanentRedirect(`/products/${params.id}`);
}
