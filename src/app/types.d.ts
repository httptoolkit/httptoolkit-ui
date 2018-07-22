import { OngoingRequest, CompletedRequest } from 'mockttp';
import { ComponentClass } from 'react';

export { CompletedRequest };
export type MockttpRequest = CompletedRequest;

export type DomWithProps<T, Props> = ComponentClass<React.DetailedHTMLProps<React.HTMLAttributes<T> & Props, T>>