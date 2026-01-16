import Image from "next/image";
import { brand } from "@/lib/brand";

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export default function BrandLogo({ size = 40, className }: BrandLogoProps) {
  return (
    <Image
      src={brand.logoPath}
      alt={brand.logoAlt}
      width={size}
      height={size}
      className={className}
      priority
      onError={() => console.error("Logo failed to load", brand.logoPath)}
    />
  );
}
