import { action, runInAction } from 'mobx';


import { AccountStore } from '../../../model/account/account-store';
import { UiStore } from '../../../model/ui/ui-store';

import { IEList, IncludeExcludeList } from '../../../model/IncludeExcludeList';

import { copyToClipboard } from '../../../util/ui';
import { ContextMenuItem } from '../../../model/ui/context-menu';




export interface HeadersHeaderClickedData {
    HeadersIncludeExcludeList : IncludeExcludeList<string>
}

export interface HeaderEvent {
	HeadersIncludeExcludeList: IncludeExcludeList<string>,
	header_name: string;
	header_value: string[];
}

export class HeadersHeaderContextMenuBuilder {

    constructor(
        private uiStore: UiStore
    ) {}

    getContextMenuCallback(event: HeadersHeaderClickedData) {
        return (mouseEvent: React.MouseEvent) => {
			let excluded = event.HeadersIncludeExcludeList.GetKeysOnList(IEList.Exclude);

			this.uiStore.handleContextMenuEvent(mouseEvent, [

				{
					type: 'submenu',
					enabled: excluded.length > 0,
					label: `Excluded`,
					items: [
						{
							type: 'option',
							label: `Clear All Excluded Headers`,
							callback: async (data) => data.HeadersIncludeExcludeList.ClearList(IEList.Exclude)
							
						},
						...
						(excluded.map((headerName) => ({

                                type: 'option',
                                label: `Clear '${headerName}'`,
                                callback: async (data: HeadersHeaderClickedData) => 
								data.HeadersIncludeExcludeList.RemoveFromList(headerName,IEList.Exclude)
                                    
                                    
                                }
                            ))
							 ) as ContextMenuItem<HeadersHeaderClickedData>[]
					]
				}


			], event
           
			);
        };
    }
}

export class HeadersContextMenuBuilder {

    constructor(
        private accountStore: AccountStore,
        private uiStore: UiStore
    ) {}

    getContextMenuCallback(event: HeaderEvent) {
        return (mouseEvent: React.MouseEvent) => {
            const { isPaidUser } = this.accountStore;
			let isPinned = event.HeadersIncludeExcludeList.IsKeyOnList(event.header_name,IEList.Favorite);

			this.uiStore.handleContextMenuEvent(mouseEvent,  [
				{
					type: 'option',
					label: (isPinned ? `Unpin` : `Pin`) + ` This Header`,
					callback: async (data) => {
						isPinned ? data.HeadersIncludeExcludeList.RemoveFromList(data.header_name,IEList.Favorite) : data.HeadersIncludeExcludeList.AddOrUpdateToList(data.header_name,IEList.Favorite);
					}
				},
				{
					type: 'option',
					label: `Exclude This Header`,
					callback: async (data) => {
						data.HeadersIncludeExcludeList.AddOrUpdateToList(data.header_name,IEList.Exclude);
					}
				},
				{
					type: 'option',
					label: `Copy Header Value`,
					callback: async (data) => copyToClipboard( data.header_value.join("\n" ) )
						
					
				}

			], event
           
			);
        };
    }
}