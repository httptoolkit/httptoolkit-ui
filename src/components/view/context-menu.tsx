import * as React from 'react';
import { HTMLContextMenu } from './html-context-menu';
export type ClickEventType = React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement> | React.KeyboardEvent<HTMLElement> | KeyboardEvent;
export interface ContextItemClicked {
	(e: ClickEventType, props: object): void;
}
export interface ContextMenu {
	CreateContextMenu(items: BaseContextMenuItem[]): void;
	//AttachMenuToItem(domElem: any, props: any): JSX.Element;
	GetContextMenuHandler(props: any): React.MouseEventHandler<HTMLDivElement>;
	menu: JSX.Element | null;
}
let GetNewContextMenu: ContextMenuGenerator = (component_id?: string) => {
	throw new Error('NewContextMenu Initializer not defined');
}
export { GetNewContextMenu }

interface ContextMenuGenerator {
	(component_id?: string): ContextMenu;
}

export function SetNewContextMenuGenerator(gen: ContextMenuGenerator) {
	GetNewContextMenu = gen;
}
SetNewContextMenuGenerator((component_id?: string) => new HTMLContextMenu(component_id));
export class BaseContextMenuItem {
	hidden?= () => false;
	static auto_comp_id = 4567;
	component_id: string;
	constructor(component_id: string | null = null) {
		if (!component_id)
			component_id = "ConMenuItemID" + BaseContextMenuItem.auto_comp_id++;
		this.component_id = component_id;
	}
}
export class SeparatorMenuItem extends BaseContextMenuItem { }
export interface ContextMenuItemArgs extends TitledMenuItemArgs {
	onClick: ContextItemClicked;
}
export interface TitledMenuItemArgs {
	disabled?(): boolean;
	hidden?(): boolean;
	component_id?: string;
	title: string;

}
export interface SubMenuItemArgs extends TitledMenuItemArgs {
	sub_items: BaseContextMenuItem[];
}


export class TitledContextMenuItem extends BaseContextMenuItem {
	disabled = () => this.is_disabled;
	title: string;
	is_hidden: boolean;
	is_disabled: boolean;
	constructor(props: TitledMenuItemArgs | null = null) {
		super(props?.component_id);
		this.title = "";
		this.is_hidden = false;
		this.is_disabled = false;
		if (props)
			Object.assign(this, props);
	}

	hidden = () => this.is_hidden;
	Hide(hide = true) {
		this.is_hidden = hide;
	}
	Disable(disable = true) {
		this.is_disabled = disable;
	}

}
export class SubMenuItem extends TitledContextMenuItem {
	sub_items?: BaseContextMenuItem[];
	constructor(props: SubMenuItemArgs | null = null) {
		super(props);
	}
}
export class ContextMenuItem extends TitledContextMenuItem {
	constructor(props: ContextMenuItemArgs | null = null) {
		super(props);
	}
	onClick(e: ClickEventType, props: any) { };
}
