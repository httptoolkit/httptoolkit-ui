import * as React from 'react';
import * as ReactDOM from 'react-dom';

class Main extends React.Component {
  render() {
    return <div>Hello from React</div>;
  }
}

window.onload = function(){
  ReactDOM.render(<Main />, document.getElementById('app'));
}