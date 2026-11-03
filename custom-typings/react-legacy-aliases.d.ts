// @types/react 18 removed this deprecated alias, but mobx-react-lite 2's typings still use it.
import 'react';

declare module 'react' {
    interface RefForwardingComponent<T, P = {}> extends ForwardRefRenderFunction<T, P> {}
}
