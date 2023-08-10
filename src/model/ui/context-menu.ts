import { NativeContextMenuItem } from "../../services/desktop-api";
import { UnreachableCheck } from "../../util/error";

export interface ContextMenuState<T> {
    data: T;
    event: React.MouseEvent;
    items: readonly ContextMenuItem<T>[];
}

export type ContextMenuItem<T> =
    | ContextMenuOption<T>
    | ContextMenuSubmenu<T>
    | { type: 'separator' };

export interface ContextMenuOption<T> {
    type: 'option';
    label: string;
    enabled?: boolean;
    callback: (data: T) => void;
}

interface ContextMenuSubmenu<T> {
    type: 'submenu';
    label: string;
    enabled?: boolean;
    items: readonly ContextMenuItem<T>[];
}

export function buildNativeContextMenuItems(
    items: readonly ContextMenuItem<any>[],
    path: Array<string | number> = []
): NativeContextMenuItem[] {
    return items.map((item, i) => {
        if (item.type === 'separator') return item;
        else if (item.type === 'submenu') return {
            ...item,
            items: buildNativeContextMenuItems(item.items, path.concat(`${i}.items`))
        };
        else if (item.type === 'option') return {
            ...item,
            callback: undefined, // Causes errors, as it can't be cloned
            id: path.concat(i).join('.') // Id is the path to the item (as an _.get key like "0.items.5")
        };
        else throw new UnreachableCheck(item, i => i.type);
    });
}