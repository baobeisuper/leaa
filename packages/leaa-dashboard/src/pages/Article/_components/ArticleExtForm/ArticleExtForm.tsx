import React from 'react';
import cx from 'classnames';
import { Col, Form, Input, Row } from 'antd';
import { withTranslation } from 'react-i18next';
import { FormComponentProps } from 'antd/lib/form';

import { Article } from '@leaa/common/entrys';
import { ITfn } from '@leaa/dashboard/interfaces';
import { FormCard } from '@leaa/dashboard/components/FormCard';

import style from './style.less';

interface IFormProps extends FormComponentProps {
  className?: string;
  item?: Article;
  loading?: boolean;
}

type IProps = IFormProps & ITfn;

class ArticleExtFormInner extends React.PureComponent<IProps> {
  constructor(props: IProps) {
    super(props);
  }

  render() {
    const { t } = this.props;

    const { props } = this;
    const { getFieldDecorator } = this.props.form;

    return (
      <div className={cx(style['wrapper'], props.className)}>
        <FormCard title={t('_page:Article.Component.extendedInfo')}>
          <Form className={cx('g-form--zero-margin-bottom', style['form-wrapper'])}>
            <Row gutter={16} className={style['form-row']}>
              <Col xs={24} sm={8}>
                <Form.Item label={t('_lang:slug')}>
                  {getFieldDecorator('slug', {
                    initialValue: props.item ? props.item.slug : undefined,
                    rules: [],
                  })(<Input placeholder={t('_lang:slug')} />)}
                </Form.Item>
              </Col>

              {/* <Col xs={24} sm={4}> */}
              {/*  <Form.Item label={t('_lang:user')}> */}
              {/*    {getFieldDecorator('userId', { */}
              {/*      initialValue: props.item ? props.item.userId : undefined, */}
              {/*      rules: [{ required: true }], */}
              {/*      normalize: e => Number(e), */}
              {/*    })(<Input type="number" placeholder={t('_lang:user')} />)} */}
              {/*  </Form.Item> */}
              {/* </Col> */}

              <Col xs={24} sm={6}>
                <Form.Item label={t('_lang:createdAt')}>
                  <Input
                    value={props.item ? `${props.item.createdAt}` : undefined}
                    placeholder={t('_lang:createdAt')}
                    readOnly
                    disabled
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={6}>
                <Form.Item label={t('_lang:updatedAt')}>
                  <Input
                    value={props.item ? `${props.item.updatedAt}` : undefined}
                    placeholder={t('_lang:updatedAt')}
                    readOnly
                    disabled
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16} className={style['form-row']}>
              <Col xs={24}>
                <Form.Item label={t('_lang:description')}>
                  {getFieldDecorator('description', {
                    initialValue: props.item ? props.item.description : undefined,
                    rules: [],
                  })(<Input.TextArea rows={3} placeholder={t('_lang:description')} />)}
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </FormCard>
      </div>
    );
  }
}

// @ts-ignore
export const ArticleExtForm = withTranslation()(Form.create<IFormProps>()(ArticleExtFormInner));