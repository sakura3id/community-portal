interface BadgeProps {
  label: string;
  variant?: 
    | 'resident'
    | 'non-resident'
    | 'owner'
    | 'global-admin'
    | 'secretariat-admin'
    | 'vendor'
    | 'approved'
    | 'pending'
    | 'unsubmitted'
    | 'suspended'
    | 'rejected'
    | 'standard-resident'
    | 'resident-verifier'
    | 'identity-active';
  className?: string;
}

export function Badge({ label, variant = 'resident', className = '' }: BadgeProps) {
  return (
    <span className={`badge-mobile badge-${variant} ${className}`.trim()}>
      {label}
    </span>
  );
}
