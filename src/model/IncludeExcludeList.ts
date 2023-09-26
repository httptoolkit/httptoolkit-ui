import * as _ from 'lodash';

export enum IEList { //these are flags so no direct equals, nothing requires them to be used as flags, but it would allow you to have an entry on both Include and Favorite at the same type
	Invalid = 0,
	Include = 1 << 1,
	Exclude = 1 << 2,
	Favorite = 1 << 3,
}

function* mapIterableImpl<T, U>(f: (val: T) => U, iterable: Iterable<T>): Iterable<U> {
	for (const item of iterable) {
		yield f(item);
	}
}
const mapIterable = <T, U>(f: (val: T) => U) => (iterable: Iterable<T>) => mapIterableImpl(f, iterable);
function* filterIterableImpl<T>(f: (item: T) => boolean, iterable: Iterable<T>): Iterable<T> {
	for (const item of iterable) {
	  if (f(item)) {
		yield item;
	  }
	}
  }
const filterIterable = <T>(f: (val: T) => boolean) => (iterable: Iterable<T>) => filterIterableImpl(f, iterable);

interface SerializeData<ListKeyType>{
	known : Map<ListKeyType, IEList>;
}
type ItemResolver<T, TResult> = (value: T) => TResult;

export class IncludeExcludeList<ListKeyType> {

	protected known = new Map<ListKeyType, IEList>();

	GetSaveDataObject() : Object {
		return {known:new Map(this.known)} as SerializeData<ListKeyType>;
	}
	static LoadFromSaveDataObject<ListKeyType>(object : object) : IncludeExcludeList<ListKeyType> {
		let ret = new IncludeExcludeList<ListKeyType>();
		ret.known = new Map((object as SerializeData<ListKeyType>).known);
		return ret;
	}

	AddOrUpdateToList = (key: ListKeyType, list: IEList) => this.known.set(key, list);
	RemoveFromLists = (key: ListKeyType) => this.known.delete(key);
	ClearList(list: IEList){
		let keys = this.GetKeysOnList(list);
		for (const key of keys)
			this.RemoveFromList(key,list);
	}
	RemoveFromList(key: ListKeyType, list: IEList){
		let current = this.GetKeyList(key);
		if (current == undefined)
			return;
		current &= ~list;
		if (current == IEList.Invalid)
			this.known.delete(key);
		else
			this.AddOrUpdateToList(key, current);
	}
	
	GetKeyList = (key: ListKeyType) => this.known.get(key);
	GetKeysOnList(list: IEList) : ListKeyType[] {
		  let filtered = filterIterable((kvp : [ListKeyType, IEList]) => (kvp[1] & list) != 0)(this.known.entries());
		  let mapped = mapIterable((kvp : [ListKeyType, IEList]) => kvp[0])(filtered);
		  return Array.from( mapped );
	}
	IsKeyOnList(key : ListKeyType, list: IEList, trueIfUnknown : boolean = false){
		let val = this.GetKeyList(key);
		if (val === undefined)
			return trueIfUnknown;
		return (val & list) != 0;
	}

	/// returnUnknown true if you want items not on any list, false if they should be excluded
	FilterArrayAgainstList<T>(arr: Iterable<T>, list: IEList, returnUnknown : boolean = false, resolver : ItemResolver<T,ListKeyType>|undefined=undefined) : Iterable<T>{
		if (!resolver)
			resolver = (itm) => itm as any;
		return filterIterable( (key : T) => this.IsKeyOnList(resolver!(key),list,returnUnknown))(arr);
	}

	/// return the list in the same order passed in except all items that are on the specified list are returned first
	* SortArrayAgainstList<T>(arr: Iterable<T>, list: IEList, resolver : ItemResolver<T,ListKeyType>|undefined=undefined) : IterableIterator<T> {
		let after = new Array() as Array<T>;
		if (! resolver)
			resolver = (itm) => itm as any;
		for (const item of arr) {
			if (this.IsKeyOnList(resolver(item),list))
				yield item;
			else
				after.push(item);
		}
		for (const itm of after)
			yield itm;
	}

}