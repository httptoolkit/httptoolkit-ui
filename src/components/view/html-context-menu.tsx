import { Menu, Item, Separator, Submenu, useContextMenu, PredicateParams, ItemProps, ItemParams } from "react-contexify";
import * as React from 'react';
import { ContextMenu, SubMenuItem, TitledContextMenuItem, ClickEventType, BaseContextMenuItem, ContextMenuItem, SeparatorMenuItem } from "./context-menu";

type ItemData = any;

export class HTMLContextMenu implements ContextMenu {
  constructor(component_id?: string) {
    this.menu = null;
    this.items = null;
    if (!component_id)
      component_id = "ContextMenu" + HTMLContextMenu.auto_id++;
    this.component_id = component_id;
  }
  static auto_id = 4567;
  component_id: string;
  menu: JSX.Element | null;

  ContextMenuItemClicked({ id, event, props, data, triggerEvent }: ItemParams<ItemProps, ItemData>){

    let item = this.GetContextMenuItemById(this.items, id);
    if (item && item instanceof ContextMenuItem)
      item.onClick(event, props);
  }


  protected GetContextMenuItemById(items: BaseContextMenuItem[] | null | undefined, id: string | undefined): BaseContextMenuItem | null {
    if (!items)
      return null;
    let item = items?.find(i => i.component_id === id);
    if (item == null) {
      items?.forEach(sub_item => {
        if (sub_item instanceof SubMenuItem)
          return this.GetContextMenuItemById(sub_item.sub_items, id);
      });
    }
    if (!item)
      return null;
    return item;
  }

  items: BaseContextMenuItem[] | null;
  CreateContextMenu(items: BaseContextMenuItem[]) {
    this.items = items;
    this.menu = this.CreateMenuComponent(items);
    return this.menu;
  }
  GetContextMenuHandler(props: any) {
    return (e: ClickEventType) => this.displayMenu(e, props);
  }
  // AttachMenuToItem(domElem: any, props: any) {
  //   domElem.setState( {onContextMenu: );
  //   //would need to ues clonelem
  //   return domElem;
  // }
  displayMenu(e: ClickEventType, props: object) {
    useContextMenu({
      id: this.component_id
    }).show({ event: e, props: props });
  }

  IsDisabled = ({ id, triggerEvent, props, data }: PredicateParams<ItemProps, ItemData>) => {
    let item = this.GetContextMenuItemById(this.items, id);
    if (item && item instanceof TitledContextMenuItem)
      return item.disabled();
    return false;
  }
  IsHidden = ({ id, triggerEvent, props, data }: PredicateParams<ItemProps, ItemData>) => {
    let item = this.GetContextMenuItemById(this.items, id);
    if (item && item instanceof TitledContextMenuItem)
      return item.hidden();
    return false;
  }
  GetItem(item: BaseContextMenuItem) {
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
  CreateMenuComponent(items: BaseContextMenuItem[]) {

    return (<>
      <Menu id={this.component_id}>
        {items.map((item) => this.GetItem(item))}
      </Menu>
    </>);

  }

}