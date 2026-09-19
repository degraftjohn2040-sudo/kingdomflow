import Link from 'next/link';
import { Church } from 'lucide-react';
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-icon">
        <Church size={23} />
      </span>
      <span>
        Kingdom<span className="brand-light">Flow</span>
        <small>MEMBERS. MINISTRY. GROWTH.</small>
      </span>
    </Link>
  );
}
