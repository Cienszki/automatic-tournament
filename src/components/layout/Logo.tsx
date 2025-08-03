
import Link from 'next/link';
import Image from 'next/image';

export function Logo() {
  return (
    <Link href="/">
      <Image
        src="/logo_transparent.webp"
        alt="Letnia Batalia Logo"
        width={150} // Adjust width as needed
        height={150} // Adjust height as needed
        className="cursor-pointer"
        priority
        unoptimized
      />
    </Link>
  );
}
