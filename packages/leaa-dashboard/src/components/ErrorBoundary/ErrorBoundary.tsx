import React from 'react';
import queryString from 'query-string';
import { Button } from 'antd';

import { urlUtil } from '@leaa/dashboard/src/utils';

import style from './style.module.less';

interface IProps {}

interface IState {
  hasError: boolean;
  errorInfo: {};
}

const CATCH_HAS_REFRESH_URL_PARAM = '____catch-has-refresh';

export class ErrorBoundary extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      hasError: false,
      errorInfo: {},
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: {}) {
    // TIPS: Many times DidCatch is because the JS file can't be retrieved, so refresh it first.
    const qs = queryString.parse(window.location.search);

    if (!qs[CATCH_HAS_REFRESH_URL_PARAM]) {
      window.location.href = urlUtil.mergeParamToUrlQuery({
        window,
        params: { [CATCH_HAS_REFRESH_URL_PARAM]: 1 },
        replace: false,
      });
    }

    console.log('ALL-STACK:', info);
    console.log('ALL-ERROR:', error);

    this.setState({ errorInfo: error.message });
  }

  onGoToHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={style['wrapper']}>
          <div className={style['container']}>
            <div className={style['title']}>
              <Button type="primary" shape="circle" icon="disconnect" onClick={this.onGoToHome} />
              <strong>Server Error</strong>
            </div>

            <div className={style['error-info']}>
              <code>{JSON.stringify(this.state.errorInfo)}</code>
              <Button
                shape="circle"
                icon="close"
                size="small"
                onClick={this.onGoToHome}
                className={style['close-error-info']}
              />
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
