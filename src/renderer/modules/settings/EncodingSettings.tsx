import { Form, Select } from 'antd';
import { useEffect } from 'react';

const options = [
  { title: 'UTF-8', value: 'UTF-8' },
  { title: 'UTF-16', value: 'UTF-16' },
  { title: 'UTF-32', value: 'UTF-32' },
  { title: 'ASCII', value: 'ASCII' },
  { title: 'ISO-8859-1', value: 'ISO-8859-1' },
  { title: 'ISO-8859-2', value: 'ISO-8859-2' },
  { title: 'ISO-8859-3', value: 'ISO-8859-3' },
  { title: 'ISO-8859-4', value: 'ISO-8859-4' },
  { title: 'ISO-8859-5', value: 'ISO-8859-5' },
  { title: 'ISO-8859-6', value: 'ISO-8859-6' },
  { title: 'ISO-8859-7', value: 'ISO-8859-7' },
  { title: 'ISO-8859-8', value: 'ISO-8859-8' },
  { title: 'ISO-8859-9', value: 'ISO-8859-9' },
  { title: 'ISO-8859-13', value: 'ISO-8859-13' },
  { title: 'ISO-8859-15', value: 'ISO-8859-15' },
  { title: 'ISO-8859-16', value: 'ISO-8859-16' },
  { title: 'Windows-1250', value: 'Windows-1250' },
  { title: 'Windows-1251', value: 'Windows-1251' },
  { title: 'Windows-1252', value: 'Windows-1252' },
  { title: 'Windows-1253', value: 'Windows-1253' },
  { title: 'Windows-1254', value: 'Windows-1254' },
  { title: 'Windows-1255', value: 'Windows-1255' },
  { title: 'Windows-1256', value: 'Windows-1256' },
  { title: 'Windows-1257', value: 'Windows-1257' },
  { title: 'Windows-1258', value: 'Windows-1258' },
  { title: 'CP437', value: 'CP437' },
  { title: 'CP850', value: 'CP850' },
  { title: 'CP852', value: 'CP852' },
  { title: 'CP865', value: 'CP865' },
  { title: 'CP866', value: 'CP866' },
  { title: 'Shift JIS', value: 'Shift JIS' },
  { title: 'EUC-JP', value: 'EUC-JP' },
  { title: 'GB2312', value: 'GB2312' },
  { title: 'GBK', value: 'GBK' },
  { title: 'GB18030', value: 'GB18030' },
  { title: 'Big5', value: 'Big5' },
  { title: 'KOI8-R', value: 'KOI8-R' },
  { title: 'KOI8-U', value: 'KOI8-U' },
  { title: 'MacRoman', value: 'MacRoman' },
  { title: 'MacCyrillic', value: 'MacCyrillic' },
  { title: 'ISO-2022-JP', value: 'ISO-2022-JP' },
  { title: 'ISO-2022-KR', value: 'ISO-2022-KR' },
  { title: 'ISO-2022-CN', value: 'ISO-2022-CN' },
  { title: 'IBM850', value: 'IBM850' },
  { title: 'IBM852', value: 'IBM852' },
  { title: 'TIS-620', value: 'TIS-620' },
  { title: 'VISCII', value: 'VISCII' },
];
export default function EncodingSettings() {
  const [form] = Form.useForm();

  useEffect(() => {
    const storedEncoding = window.localStorage.getItem('encoding') || 'utf-8';
    form.setFieldValue('encoding', storedEncoding);

    return () => {
      const encoding = form.getFieldValue('encoding');
      window.localStorage.setItem('encoding', encoding);
    };
  }, [form]);

  return (
    <Form
      form={form}
      layout="horizontal"
      colon={false}
      labelCol={{ span: 10 }}
      wrapperCol={{ span: 6 }}
    >
      <Form.Item label="Default encoding" name="encoding">
        <Select defaultValue="UTF-8" options={options} />
      </Form.Item>
    </Form>
  );
}
