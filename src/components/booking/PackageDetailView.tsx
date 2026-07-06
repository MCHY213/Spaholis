import { motion } from "framer-motion";
import { formatCRCWithUsd } from "@/lib/currency";
import { Clock, CheckCircle2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SpaPackage } from "@/hooks/useSpaPackages";

interface Props {
  pkg: SpaPackage;
  onProceed: () => void;
}

export function PackageDetailView({ pkg, onProceed }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      {pkg.image_url && (
        <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden">
          <img src={pkg.image_url} alt={pkg.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div>
        <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Spa Package
        </p>
        <h1 className="font-heading text-3xl font-semibold text-foreground">{pkg.name}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm font-body text-muted-foreground">
        {pkg.duration_label && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {pkg.duration_label}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <DollarSign className="h-4 w-4" />
          {formatCRCWithUsd(pkg.price)}
        </span>
      </div>

      {pkg.description && (
        <p className="font-body text-base text-foreground/90 leading-relaxed">
          {pkg.description}
        </p>
      )}

      {pkg.items.length > 0 && (
        <div className="bg-muted/50 rounded-xl p-5 space-y-3">
          <h3 className="font-heading text-base font-medium text-foreground">
            Included Treatments
          </h3>
          <ul className="space-y-2">
            {pkg.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 font-body text-sm text-foreground/80">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {item.treatment_name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div>
          <p className="font-heading text-2xl font-semibold text-foreground">{formatCRCWithUsd(pkg.price)}</p>
          <p className="text-xs font-body text-muted-foreground">tax included</p>
        </div>
        <Button variant="default" size="lg" onClick={onProceed}>
          Book This Package
        </Button>
      </div>
    </motion.div>
  );
}
