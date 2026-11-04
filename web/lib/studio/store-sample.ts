// A scripted sample store for showing Muse-made items, a product catalog and
// the shopper simulation without an API key. The studio labels it scripted:
// none of it is model output, and prices and stock are invented examples.
import {
  resolveDesign,
  sceneSchema,
  type Design,
  type Product,
  type SceneObject,
  type World,
} from "./scene";

const designs: Design[] = [
  {
    id: "fridge",
    name: "Glass-door fridge",
    kind: "shelf",
    size: [1.2, 2, 0.7],
    description: "Chilled drinks and dairy behind a glass door",
    parts: [
      {
        shape: "box",
        size: [1.2, 2, 0.7],
        offset: [0, 1, 0],
        color: "#e3e7e8",
      },
      {
        shape: "box",
        size: [1.06, 1.62, 0.04],
        offset: [0, 1.06, 0.34],
        color: "#a8cfe0",
      },
      {
        shape: "box",
        size: [1.2, 0.2, 0.06],
        offset: [0, 1.9, 0.35],
        color: "#2f6f9a",
      },
      {
        shape: "box",
        size: [0.04, 0.5, 0.05],
        offset: [0.46, 1.1, 0.38],
        color: "#5f676b",
      },
      {
        shape: "cylinder",
        size: [0.12, 0.3, 0.12],
        offset: [-0.3, 1.35, 0.2],
        color: "#f4f1e8",
      },
      {
        shape: "cylinder",
        size: [0.12, 0.3, 0.12],
        offset: [0, 1.35, 0.2],
        color: "#f0a43a",
      },
      {
        shape: "cylinder",
        size: [0.12, 0.3, 0.12],
        offset: [0.3, 1.35, 0.2],
        color: "#f4f1e8",
      },
      {
        shape: "cylinder",
        size: [0.12, 0.3, 0.12],
        offset: [-0.15, 0.75, 0.2],
        color: "#f0a43a",
      },
      {
        shape: "cylinder",
        size: [0.12, 0.3, 0.12],
        offset: [0.15, 0.75, 0.2],
        color: "#f0a43a",
      },
    ],
  },
  {
    id: "produce-stand",
    name: "Produce stand",
    kind: "table",
    size: [1.8, 0.95, 1],
    description: "Two tilted tiers of fruit facing the aisle",
    parts: [
      {
        shape: "box",
        size: [1.8, 0.6, 1],
        offset: [0, 0.3, 0],
        color: "#9a6b43",
      },
      {
        shape: "box",
        size: [1.8, 0.1, 0.48],
        offset: [0, 0.65, 0.25],
        color: "#c39a70",
      },
      {
        shape: "box",
        size: [1.8, 0.24, 0.48],
        offset: [0, 0.72, -0.25],
        color: "#c39a70",
      },
      {
        shape: "sphere",
        size: [0.14, 0.14, 0.14],
        offset: [-0.55, 0.77, 0.25],
        color: "#f08a24",
      },
      {
        shape: "sphere",
        size: [0.14, 0.14, 0.14],
        offset: [-0.38, 0.77, 0.25],
        color: "#f08a24",
      },
      {
        shape: "sphere",
        size: [0.14, 0.14, 0.14],
        offset: [-0.46, 0.77, 0.12],
        color: "#f08a24",
      },
      {
        shape: "sphere",
        size: [0.13, 0.13, 0.13],
        offset: [0.38, 0.77, 0.25],
        color: "#c7312b",
      },
      {
        shape: "sphere",
        size: [0.13, 0.13, 0.13],
        offset: [0.55, 0.77, 0.25],
        color: "#c7312b",
      },
      {
        shape: "sphere",
        size: [0.13, 0.13, 0.13],
        offset: [0.46, 0.77, 0.12],
        color: "#c7312b",
      },
      {
        shape: "sphere",
        size: [0.16, 0.12, 0.16],
        offset: [-0.3, 0.9, -0.25],
        color: "#6a9a3c",
      },
      {
        shape: "sphere",
        size: [0.16, 0.12, 0.16],
        offset: [0.3, 0.9, -0.25],
        color: "#e4c341",
      },
    ],
  },
  {
    id: "bread-rack",
    name: "Bread rack",
    kind: "shelf",
    size: [1, 1.6, 0.5],
    description: "Open wire rack with loaves at eye level",
    parts: [
      {
        shape: "box",
        size: [0.05, 1.6, 0.05],
        offset: [-0.47, 0.8, 0],
        color: "#3e4540",
      },
      {
        shape: "box",
        size: [0.05, 1.6, 0.05],
        offset: [0.47, 0.8, 0],
        color: "#3e4540",
      },
      {
        shape: "box",
        size: [1, 0.04, 0.5],
        offset: [0, 0.5, 0],
        color: "#7b6a55",
      },
      {
        shape: "box",
        size: [1, 0.04, 0.5],
        offset: [0, 1, 0],
        color: "#7b6a55",
      },
      {
        shape: "box",
        size: [1, 0.04, 0.5],
        offset: [0, 1.5, 0],
        color: "#7b6a55",
      },
      {
        shape: "sphere",
        size: [0.34, 0.16, 0.2],
        offset: [-0.22, 1.1, 0],
        color: "#c98a4b",
      },
      {
        shape: "sphere",
        size: [0.34, 0.16, 0.2],
        offset: [0.22, 1.1, 0],
        color: "#b97938",
      },
      {
        shape: "sphere",
        size: [0.22, 0.1, 0.14],
        offset: [-0.25, 0.57, 0.05],
        color: "#e0a75e",
      },
      {
        shape: "sphere",
        size: [0.22, 0.1, 0.14],
        offset: [0.05, 0.57, 0.05],
        color: "#e0a75e",
      },
      {
        shape: "sphere",
        size: [0.22, 0.1, 0.14],
        offset: [0.3, 0.57, 0.05],
        color: "#e0a75e",
      },
    ],
  },
  {
    id: "checkout-lane",
    name: "Checkout lane",
    kind: "counter",
    size: [1.6, 1.25, 0.7],
    description: "Counter with a belt and a till",
    parts: [
      {
        shape: "box",
        size: [1.6, 0.9, 0.7],
        offset: [0, 0.45, 0],
        color: "#2f6f9a",
      },
      {
        shape: "box",
        size: [1.1, 0.03, 0.5],
        offset: [-0.2, 0.915, 0],
        color: "#2b2f30",
      },
      {
        shape: "box",
        size: [0.36, 0.22, 0.32],
        offset: [0.55, 1.02, 0],
        color: "#d9dbd6",
      },
      {
        shape: "box",
        size: [0.3, 0.2, 0.03],
        offset: [0.55, 1.2, -0.1],
        color: "#2b2f30",
      },
    ],
  },
];

type Spec = [string, SceneObject["kind"], number, number, string, string?];
const specs: Spec[] = [
  ["fridge-1", "shelf", -4.3, -4.5, "Dairy fridge", "fridge"],
  ["fridge-2", "shelf", -2.8, -4.5, "Drinks fridge", "fridge"],
  ["dry-goods", "shelf", 0.4, -4.6, "Dry goods shelf"],
  ["bread", "shelf", 3, -4.7, "Bread rack", "bread-rack"],
  ["produce", "table", -1.6, -0.6, "Produce stand", "produce-stand"],
  ["checkout", "counter", 3.4, 2.6, "Checkout", "checkout-lane"],
  ["plant", "plant", 5.3, 4.3, "Doorway plant"],
];

export const SAMPLE_STORE_REASONS: Record<string, string> = {
  "fridge-1": "Fridges on the back wall pull shoppers through the store.",
  "fridge-2": "A second fridge keeps drinks apart from dairy.",
  "dry-goods": "Dry goods centred on the back wall, easy to scan.",
  bread: "Bread in the corner, its smell carries to the door.",
  produce: "Fresh produce first, in the middle of the main aisle.",
  checkout: "Checkout by the door, on the way out.",
  plant: "A plant softens the entrance corner.",
};

const products: Product[] = [
  {
    id: "milk",
    name: "Milk 1 L",
    price: 1.29,
    stock: 8,
    fixtureId: "fridge-1",
    color: "#f4f1e8",
  },
  {
    id: "yoghurt",
    name: "Yoghurt",
    price: 0.89,
    stock: 6,
    fixtureId: "fridge-1",
    color: "#f2d9e0",
  },
  {
    id: "juice",
    name: "Orange juice",
    price: 2.49,
    stock: 4,
    fixtureId: "fridge-2",
    color: "#f0a43a",
  },
  {
    id: "water",
    name: "Sparkling water",
    price: 0.99,
    stock: 10,
    fixtureId: "fridge-2",
    color: "#a8cfe0",
  },
  {
    id: "pasta",
    name: "Pasta 500 g",
    price: 1.49,
    stock: 10,
    fixtureId: "dry-goods",
    color: "#e4c341",
  },
  {
    id: "coffee",
    name: "Coffee beans",
    price: 7.99,
    stock: 5,
    fixtureId: "dry-goods",
    color: "#5a3b26",
  },
  {
    id: "sourdough",
    name: "Sourdough loaf",
    price: 3.5,
    stock: 3,
    fixtureId: "bread",
    color: "#c98a4b",
  },
  {
    id: "apples",
    name: "Apples",
    price: 0.6,
    stock: 12,
    fixtureId: "produce",
    color: "#c7312b",
  },
  {
    id: "oranges",
    name: "Oranges",
    price: 0.5,
    stock: 2,
    fixtureId: "produce",
    color: "#f08a24",
  },
];

export function sampleStore(): World {
  const objects = specs.map(
    ([id, kind, x, z, label, designId]): SceneObject =>
      resolveDesign(
        {
          id,
          kind,
          label,
          x,
          z,
          rotation: 0,
          scale: 1,
          color:
            designs.find((d) => d.id === designId)?.parts[0].color || "#687b64",
          ...(designId ? { designId } : {}),
        },
        designs,
      ),
  );
  return sceneSchema.parse({
    version: 1,
    name: "Corner grocery (sample)",
    lighting: "day",
    objects,
    designs,
    products,
  });
}
