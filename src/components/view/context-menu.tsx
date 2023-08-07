import * as React from 'react';

export type ClickEventType = React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement> | React.KeyboardEvent<HTMLElement> | KeyboardEvent;
export interface ContextItemClicked<PropType> {
	(e: ClickEventType, props: PropType): void;
}
export abstract class ContextMenu<PropType> {
	abstract SetContextMenuItems(items: BaseContextMenuItem<PropType>[]): void;
	abstract AppendContextMenuItem(item: BaseContextMenuItem<PropType>): void;
	//abstract CreateMenuItem();
	//AttachMenuToItem(domElem: any, props: any): JSX.Element;
	abstract GetContextMenuHandler(props: PropType): React.MouseEventHandler<HTMLDivElement>;
	abstract GetMenuComponent(): JSX.Element | null;

	/* These helper functions are to support generic inferring so you don't have to specify it multiple times */
	NewSubMenuItem(args: SubMenuItemArgs<PropType>) {
		return new SubMenuItem(args);
	}
	NewMenuItem(args: ContextMenuItemArgs<PropType>) {
		return new ContextMenuItem(args);
	}
	NewSeparatorItem() {
		return new SeparatorMenuItem();
	}

}
let GetNewContextMenu: ContextMenuGenerator = (component_id?: string) => {
	throw new Error('NewContextMenu Initializer not defined');

}

export { GetNewContextMenu }

interface ContextMenuGenerator {
	<PropType>(component_id?: string): ContextMenu<PropType>;
}

export function SetNewContextMenuGenerator(gen: ContextMenuGenerator) {
	GetNewContextMenu = gen;
}

export class BaseContextMenuItem<PropType> {
	hidden?= (props: PropType) => false;
	static auto_comp_id = 4567;
	component_id: string;
	constructor(component_id: string | null = null) {
		if (!component_id)
			component_id = "ConMenuItemID" + BaseContextMenuItem.auto_comp_id++;
		this.component_id = component_id;
	}
}
export class SeparatorMenuItem<PropType> extends BaseContextMenuItem<PropType> { }
export interface ContextMenuItemArgs<PropType> extends TitledMenuItemArgs<PropType> {
	onClick: ContextItemClicked<PropType>;
}
export interface TitledMenuItemArgs<PropType> {
	disabled?(props: PropType): boolean;
	hidden?(props: PropType): boolean;
	component_id?: string;
	title: string;

}
export interface SubMenuItemArgs<PropType> extends TitledMenuItemArgs<PropType> {
	sub_items: BaseContextMenuItem<PropType>[];
}


export class TitledContextMenuItem<PropType> extends BaseContextMenuItem<PropType> {
	disabled = (props: PropType) => this.is_disabled;
	title: string;
	is_hidden: boolean;
	is_disabled: boolean;
	constructor(props: TitledMenuItemArgs<PropType> | null = null) {
		super(props?.component_id);
		this.title = "";
		this.is_hidden = false;
		this.is_disabled = false;
		if (props)
			Object.assign(this, props);
	}

	hidden = (props: PropType) => this.is_hidden;
	Hide(hide = true) {
		this.is_hidden = hide;
	}
	Disable(disable = true) {
		this.is_disabled = disable;
	}

}
export class SubMenuItem<PropType> extends TitledContextMenuItem<PropType> {
	sub_items?: BaseContextMenuItem<PropType>[];
	constructor(props: SubMenuItemArgs<PropType> | null = null) {
		super(props);
	}
}
export class ContextMenuItem<PropType> extends TitledContextMenuItem<PropType> {
	constructor(props: ContextMenuItemArgs<PropType> | null = null) {
		super(props);
	}
	onClick(e: ClickEventType, props: PropType) { };
}

