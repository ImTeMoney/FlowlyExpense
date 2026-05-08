import {
  ShoppingCart, Home, Car, Clapperboard, Zap, Shield,
  UtensilsCrossed, Plane, Package, Coffee, ShoppingBag,
  Dumbbell, BookOpen, Music, Gamepad2, Scissors, PawPrint,
  Baby, GraduationCap, Pill, Stethoscope, Gift, Shirt,
  Monitor, Smartphone, Fuel, Bike, Bus, Beer, Pizza, CreditCard,
  PiggyBank, Camera, Leaf, Trophy, Activity, Truck,
} from 'lucide-react';
import type { Category } from '../context/ExpenseContext';
import { useLang } from '../context/LanguageContext';

type IconFC = React.FC<{ size?: number; strokeWidth?: number; color?: string }>;

/** Built-in category ID → icon */
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

/** String icon key (from iconSuggest) → Lucide component */
export const ICON_MAP: Record<string, IconFC> = {
  ShoppingCart, Home, Car, Clapperboard, Zap, Shield,
  UtensilsCrossed, Plane, Package, Coffee, ShoppingBag,
  Dumbbell, BookOpen, Music, Gamepad2, Scissors, PawPrint,
  Baby, GraduationCap, Pill, Stethoscope, Gift, Shirt,
  Monitor, Smartphone, Fuel, Bike, Bus, Beer, Pizza, CreditCard,
  PiggyBank, Camera, Leaf, Trophy, Activity, Truck,
};

/** Resolve the best Lucide icon for a category (named icon > built-in ID > Package) */
export function resolveCatIcon(cat: Category | undefined): IconFC {
  if (!cat) return Package;
  if (cat.icon && ICON_MAP[cat.icon]) return ICON_MAP[cat.icon];
  return CAT_ICON[cat.id] ?? Package;
}

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
        const Icon = resolveCatIcon(cat);
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
            <Icon
              size={20}
              strokeWidth={1.8}
              color={selected ? cat.color : undefined}
            />
            <span className="cat-chip-name">{catName(cat.id, cat.name, cat.isRenamed)}</span>
          </button>
        );
      })}
    </div>
  );
}
