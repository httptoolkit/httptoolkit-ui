import * as _ from 'lodash';
import * as React from 'react';

export function filterProps<T extends object, K extends string>(Component: React.ComponentType<T>, ...keys: K[]): React.ComponentType<T> {
    return (props: T) => <Component {..._.omit(props, keys)} />;
}