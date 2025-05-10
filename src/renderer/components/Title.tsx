import { Flex } from 'antd';

export default function Title(props: any) {
  const { title, example } = props;
  return (
    <Flex align="center" justify="space-between">
      <strong>{title}</strong>
      <span>{example}</span>
    </Flex>
  );
}
