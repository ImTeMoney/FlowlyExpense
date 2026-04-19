import {
  ShoppingCart, Home, Car, Clapperboard, Zap, Shield,
  UtensilsCrossed, Plane, Package,
} from 'lucide-react';
import type { Category } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';

type IconFC = React.FC<{ size?: number; color?: string }>;

export const CAT_ICON: Record<string, IconFC> = {
  cat_groceries:     ShoppingCart,
  cat_rent:          Home,
  cat_transport:     Car,
  cat_entertainment: Clapperboard,
  cat_utilities:     Zap,
  cat_insurance:     Shield,
  cat_dining:        UtensilsCrossed,
  cat_travel:        Plane,
  cat_other:         Package,
};

interface Props {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}

export default function CategoryPicker({ categories, value, onChange }: Props) {
  const { catName } = useLang();
  return (
    <div className="cat-picker-grid">
      {categories.map(cat => {
        const Icon = CAT_ICON[cat.id] ?? Package;
        const selected = cat.id === value;
        return (
          <button
            key={cat.id}
            type="button"
            className={`cat-chip${selected ? ' selected' : ''}`}
            onClick={() => onChange(cat.id)}
            aria-pressed={selected}
            style={selected ? {
              borderColor: cat.color,
              background: `${cat.color}1A`,
              boxShadow: `0 0 12px ${cat.color}40`,
            } : undefined}
          >
            <Icon size={20} color={selected ? cat.color : 'var(--text-muted)'} />
            <span className="cat-chip-name">{catName(cat.id, cat.name, cat.isRenamed)}</span>
          </button>
        );
      })}
    </div>
  );
}
