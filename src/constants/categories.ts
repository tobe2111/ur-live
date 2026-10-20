/**
 * 카테고리 상수 정의 (통합)
 * 
 * 프로젝트 전체에서 사용하는 표준 카테고리 목록
 */

export const PRODUCT_CATEGORIES = {
  ALL: 'all',
  FOOD: 'food',
  FASHION: 'fashion',
  BEAUTY: 'beauty',
  KIDS: 'kids',
  GOODS: 'goods',
  ELECTRONICS: 'electronics',
  LIFESTYLE: 'lifestyle',
  HOME: 'home',
  SPORTS: 'sports',
} as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[keyof typeof PRODUCT_CATEGORIES];

/**
 * 카테고리 라벨 (한글)
 */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  all: '전체',
  food: '식품',
  fashion: '패션',
  beauty: '뷰티',
  kids: '유아동',
  goods: '잡화',
  electronics: '전자제품',
  lifestyle: '라이프스타일',
  home: '홈/리빙',
  sports: '스포츠',
};

/**
 * 메인 페이지 QuickAccess에 표시할 카테고리 (5개)
 */
export const QUICK_ACCESS_CATEGORIES = [
  PRODUCT_CATEGORIES.FOOD,
  PRODUCT_CATEGORIES.FASHION,
  PRODUCT_CATEGORIES.BEAUTY,
  PRODUCT_CATEGORIES.KIDS,
  PRODUCT_CATEGORIES.GOODS,
] as const;

/**
 * Browse 페이지 필터에 표시할 카테고리 (전체)
 */
export const BROWSE_CATEGORIES = [
  PRODUCT_CATEGORIES.ALL,
  PRODUCT_CATEGORIES.FOOD,
  PRODUCT_CATEGORIES.FASHION,
  PRODUCT_CATEGORIES.BEAUTY,
  PRODUCT_CATEGORIES.KIDS,
  PRODUCT_CATEGORIES.GOODS,
  PRODUCT_CATEGORIES.ELECTRONICS,
  PRODUCT_CATEGORIES.LIFESTYLE,
  PRODUCT_CATEGORIES.HOME,
  PRODUCT_CATEGORIES.SPORTS,
] as const;

/**
 * 카테고리 아이콘 매핑
 */
import { Utensils, Shirt, Sparkles, Baby, ShoppingBasket, Laptop, Home, Dumbbell, Package } from 'lucide-react';

export const CATEGORY_ICONS = {
  food: Utensils,
  fashion: Shirt,
  beauty: Sparkles,
  kids: Baby,
  goods: ShoppingBasket,
  electronics: Laptop,
  lifestyle: Package,
  home: Home,
  sports: Dumbbell,
} as const;

/**
 * 카테고리 유효성 검증
 */
export function isValidCategory(category: string): category is ProductCategory {
  return Object.values(PRODUCT_CATEGORIES).includes(category as ProductCategory);
}

/**
 * 카테고리 라벨 가져오기
 */
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as ProductCategory] || '기타';
}

/**
 * 카테고리 아이콘 가져오기
 */
export function getCategoryIcon(category: string) {
  return CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || Package;
}
