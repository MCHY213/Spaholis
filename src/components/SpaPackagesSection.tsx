import { useState } from "react";
import { formatCRCWithUsd } from "@/lib/currency";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useSpaPackages, type SpaPackage } from "@/hooks/useSpaPackages";

const fadeIn = {
  initial: { opacity: 0, y: 24 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true },
  transition: { duration: 0.6 },
};

function PackageAccordion({ pkg, isOpen, onToggle }: { pkg: SpaPackage; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-lg sm:text-xl font-semibold text-foreground tracking-wide">
            {pkg.name}
          </h3>
          <p className="font-body text-xs text-muted-foreground mt-1">
            {pkg.duration_label} · {formatCRCWithUsd(pkg.price)}
          </p>
        </div>
        <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 ml-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="overflow-hidden"
          >
            <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4">
              {pkg.description && (
                <p className="font-body text-sm text-muted-foreground italic">
                  {pkg.description}
                </p>
              )}
              <ul className="space-y-2">
                {pkg.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-body text-sm text-primary mt-0.5">•</span>
                    <span className="font-body text-sm text-foreground">{item.treatment_name}</span>
                  </li>
                ))}
              </ul>
              <Button variant="spa" size="lg" className="w-full sm:w-auto" asChild>
                <Link to={`/book?package=${pkg.id}`}>
                  Book {pkg.duration_label} Package: {formatCRCWithUsd(pkg.price)}
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SpaPackagesSection() {
  const { data: packages, isLoading } = useSpaPackages();
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading || !packages?.length) return null;

  return (
    <section id="spa-packages" className="py-20 px-4 sm:px-6 lg:px-8">
      <motion.div {...fadeIn} className="max-w-3xl mx-auto text-center mb-12">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Curated Experiences
        </p>
        <h2 className="spa-heading-lg text-foreground mb-4">Spa Packages</h2>
        <p className="spa-body text-muted-foreground max-w-xl mx-auto">
          Powerful combinations of treatments designed to enhance and complement one another, restoring you to a refreshed sense of being.
        </p>
      </motion.div>

      <div className="max-w-3xl mx-auto space-y-4">
        {packages.map((pkg, i) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
          >
            <PackageAccordion
              pkg={pkg}
              isOpen={openId === pkg.id}
              onToggle={() => setOpenId(openId === pkg.id ? null : pkg.id)}
            />
          </motion.div>
        ))}
      </div>

      <motion.p {...fadeIn} className="text-center font-body text-xs text-muted-foreground mt-8 italic">
        All prices are tax-inclusive
      </motion.p>
    </section>
  );
}
