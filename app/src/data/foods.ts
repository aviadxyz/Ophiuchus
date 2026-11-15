// The space menu. ILLUSTRATIVE: these are plausible values for typical foods, not measured
// values for any real flight menu. See data/README.md.

import type { FoodItem } from './types'

type Row = [
  id: string,
  name: string,
  kcal: number,
  proteinG: number,
  sodiumMg: number,
  calciumMg: number,
  ironMg: number,
  vitaminDIu: number,
  omega3G: number,
  potassiumMg: number,
  waterMl: number,
]

const rows: Row[] = [
  ['scrambled-eggs', 'Scrambled eggs', 240, 15, 520, 70, 1.0, 60, 0.1, 190, 60],
  ['oatmeal-raisins', 'Oatmeal with raisins', 310, 9, 180, 110, 1.2, 0, 0.1, 380, 150],
  ['granola-blueberries', 'Granola with blueberries', 330, 8, 90, 60, 1.0, 0, 0.2, 280, 30],
  ['cereal-milk', 'Cereal with powdered milk', 280, 10, 260, 300, 1.4, 100, 0, 330, 120],
  ['flour-tortilla', 'Flour tortilla', 130, 3.5, 330, 60, 0.5, 0, 0, 50, 0],
  ['beef-entree', 'Rehydratable beef entree', 330, 24, 880, 30, 1.8, 0, 0.1, 480, 140],
  ['chicken-rice', 'Chicken and rice casserole', 360, 22, 840, 50, 0.8, 0, 0.1, 400, 160],
  ['macaroni-cheese', 'Macaroni and cheese', 380, 15, 920, 260, 0.9, 40, 0.1, 230, 130],
  ['tuna-pouch', 'Tuna in a pouch', 120, 26, 320, 10, 0.6, 140, 0.6, 280, 0],
  ['salmon-pouch', 'Salmon in a pouch', 180, 22, 380, 20, 0.4, 320, 1.4, 420, 0],
  ['green-beans', 'Green beans', 45, 2, 280, 40, 0.5, 0, 0, 200, 0],
  ['mashed-potatoes', 'Mashed potatoes', 180, 4, 500, 40, 0.3, 0, 0, 640, 120],
  ['dried-fruit-mix', 'Dried apricots and apples', 140, 1.5, 10, 25, 0.6, 0, 0, 420, 0],
  ['almonds', 'Almonds', 170, 6, 0, 75, 0.7, 0, 0, 200, 0],
  ['walnuts', 'Walnuts', 190, 4.5, 0, 28, 0.5, 0, 2.5, 125, 0],
  ['peanut-butter', 'Peanut butter', 190, 7, 140, 15, 0.4, 0, 0, 210, 0],
  ['yogurt', 'Rehydratable yogurt', 150, 6, 90, 220, 0.1, 100, 0, 280, 80],
  ['cereal-bar', 'Cereal bar', 190, 3, 95, 20, 0.8, 0, 0, 110, 0],
  ['chocolate-pudding', 'Chocolate pudding', 170, 3, 160, 100, 0.5, 0, 0, 220, 60],
  ['orange-drink', 'Orange drink (rehydrated)', 60, 0, 10, 20, 0, 0, 0, 200, 250],
  ['vitamin-d', 'Vitamin D supplement', 0, 0, 0, 0, 0, 800, 0, 0, 0],
]

export const foods: readonly FoodItem[] = rows.map(
  ([
    id,
    name,
    kcal,
    proteinG,
    sodiumMg,
    calciumMg,
    ironMg,
    vitaminDIu,
    omega3G,
    potassiumMg,
    waterMl,
  ]) => ({
    id,
    name,
    kcal,
    proteinG,
    sodiumMg,
    calciumMg,
    ironMg,
    vitaminDIu,
    omega3G,
    potassiumMg,
    waterMl,
  }),
)

const byId = new Map(foods.map((food) => [food.id, food]))

export function getFood(id: string): FoodItem | undefined {
  return byId.get(id)
}
