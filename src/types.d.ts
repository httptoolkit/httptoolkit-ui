export { CompletedRequest, CompletedResponse } from 'mockttp';
import { ComponentClass } from 'react';

export type DomWithProps<T, Props> = ComponentClass<React.DetailedHTMLProps<React.HTMLAttributes<T> & Props, T>>