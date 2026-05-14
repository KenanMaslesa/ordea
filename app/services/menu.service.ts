import { db, menuPath } from "@/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getItem, setItem } from "../helper";
import { MenuNode } from "../types/order.types";

const CACHE_KEY = "@menuCache";

interface MenuCache {
  placeId: string;
  menuVersion: number;
  nodes: MenuNode[];
}

async function readCache(): Promise<MenuCache | null> {
  const raw = await getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MenuCache;
  } catch {
    return null;
  }
}

async function fetchFromFirestore(
  placeId: string,
  menuVersion: number
): Promise<MenuNode[]> {
  const snap = await getDocs(
    query(collection(db, menuPath(placeId)), orderBy("order"), orderBy("createdAt"))
  );

  const nodes: MenuNode[] = snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as Omit<MenuNode, "id">),
  }));

  const cache: MenuCache = { placeId, menuVersion, nodes };
  await setItem(CACHE_KEY, JSON.stringify(cache));

  return nodes;
}

export async function getMenu(
  placeId: string,
  menuVersion: number
): Promise<MenuNode[]> {
  const cache = await readCache();
  if (cache && cache.placeId === placeId && cache.menuVersion === menuVersion) {
    return cache.nodes;
  }
  return fetchFromFirestore(placeId, menuVersion);
}

export async function invalidateMenuCache(): Promise<void> {
  await setItem(CACHE_KEY, "");
}

/**
 * Build a recursive menu tree from flat Firestore nodes.
 * Returns root categories with nested children.
 */
export function buildMenuTree(nodes: MenuNode[]): MenuTreeNode[] {
  const byParent = new Map<string | null, MenuNode[]>();

  nodes.forEach(n => {
    const key = n.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  });

  const sortByOrder = (arr: MenuNode[]) =>
    [...arr].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

  function buildChildren(parentId: string | null): MenuTreeNode[] {
    const children = byParent.get(parentId) ?? [];
    return sortByOrder(children).map(n => ({
      ...n,
      children: n.type === "category" ? buildChildren(n.id) : [],
    }));
  }

  return buildChildren(null);
}

export interface MenuTreeNode extends MenuNode {
  children: MenuTreeNode[];
}

