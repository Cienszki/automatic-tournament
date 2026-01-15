
import Link from 'next/link';
import Image from 'next/image';

export function Logo() {
  return (
    <Link href="/">
      <Image
        src="/logos/pdl/orzeek_lewa.png"
        alt="Home"
        width={50}
        height={50}
        className="cursor-pointer"
        priority
      />
    </Link>
  );
}
