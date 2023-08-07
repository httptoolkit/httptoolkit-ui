import { Menu, Item, Separator, Submenu, useContextMenu, PredicateParams, ItemParams } from "react-contexify";
import * as React from 'react';
import { ContextMenu, SubMenuItem, TitledContextMenuItem, ClickEventType, BaseContextMenuItem, ContextMenuItem, SeparatorMenuItem, SetNewContextMenuGenerator } from "./context-menu";

type ItemData = any;

export class HTMLContextMenu<PropType> extends ContextMenu<PropType> {
  constructor(component_id?: string) {
    super();
    this.menu = null;
    this.items = [];
    if (!component_id)
      component_id = "ContextMenu" + HTMLContextMenu.auto_id++;
    this.component_id = component_id;
  }
  static auto_id = 4567;
  component_id: string;
  menu: JSX.Element | null;

  ContextMenuItemClicked = ({ id, event, props, data, triggerEvent }: ItemParams<PropType, ItemData>) => {

    let item = this.GetContextMenuItemById(this.items, id);
    if (item && item instanceof ContextMenuItem)
      item.onClick(event, props);
    else
      console.log("Unable to find sub item on context menu something likely wrong");
  }


  protected GetContextMenuItemById(items: BaseContextMenuItem<PropType>[] | null | undefined, id: string | undefined): BaseContextMenuItem<PropType> | null {
    if (!items)
      return null;
    let item = items?.find(i => i.component_id === id);
    if (item == null && items) {
      for (let sub_item of items) {
        if (sub_item instanceof SubMenuItem)
          return this.GetContextMenuItemById(sub_item.sub_items, id);
      }
    }
    if (!item)
      return null;
    return item;
  }

  items: BaseContextMenuItem<PropType>[];
  SetContextMenuItems(items: BaseContextMenuItem<PropType>[]) {
    this.items = items;
    this.menu = null;
  }
  AppendContextMenuItem(item: BaseContextMenuItem<PropType>) {
    this.items.push(item);
  }
  GetMenuComponent() {
    if (this.menu == null)
      this.menu = this.CreateMenuComponent(this.items);
    return this.menu;
  }
  GetContextMenuHandler(props: PropType) {
    return (e: ClickEventType) => this.displayMenu(e, props);
  }
  // AttachMenuToItem(domElem: any, props: any) {
  //   domElem.setState( {onContextMenu: );
  //   //would need to ues clonelem
  //   return domElem;
  // }
  displayMenu(e: ClickEventType, props: PropType) {
    let selection = window.getSelection();
    if (selection == null || selection.toString().length < 2)//if text is selected use native menu, note if text is selected but its not what we right click on this will still work as that text is deselected prior to this call
      useContextMenu({ id: this.component_id }).show({ event: e, props: props });
  }

  IsDisabled = ({ id, triggerEvent, props, data }: PredicateParams<PropType, ItemData>) => {
    let item = this.GetContextMenuItemById(this.items, id);
    if (item && item instanceof TitledContextMenuItem)
      return item.disabled(props);
    return false;
  }
  IsHidden = ({ id, triggerEvent, props, data }: PredicateParams<PropType, ItemData>) => {
    let item = this.GetContextMenuItemById(this.items, id);
    if (item && item instanceof TitledContextMenuItem)
      return item.hidden(props);
    return false;
  }
  GetItem(item: BaseContextMenuItem<PropType>) {
    if (item instanceof SubMenuItem) {
      return <Submenu id={item.component_id} label={item.title}>
        {item.sub_items?.map((item) => this.GetItem(item))}
      </Submenu>;
    }
    else if (item instanceof ContextMenuItem)
      return <Item disabled={this.IsDisabled} hidden={this.IsHidden} id={item.component_id} key={item.component_id} onClick={this.ContextMenuItemClicked}>{item.title}</Item>;
    else if (item instanceof SeparatorMenuItem)
      return <Separator key={item.component_id} />
  }
  CreateMenuComponent(items: BaseContextMenuItem<PropType>[]) {

    return (<>
      <Menu id={this.component_id}>
        {items.map((item) => this.GetItem(item))}
      </Menu>
    </>);

  }

}
SetNewContextMenuGenerator(<PropType,>(component_id?: string) => new HTMLContextMenu<PropType>(component_id));
export function noop() { }