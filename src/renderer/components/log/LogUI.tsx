import { Avatar, Dropdown, MenuProps, Tag, Tooltip } from 'antd';

const items: MenuProps['items'] = [
  {
    label: 'Copy commit sha',
    key: '1',
  },
];
export default function LogUI({
  output,
  isAuthorEnabled,
  isCommitDateEnabled,
  isHashEnabled,
  isRefsEnabled,
  shouldHide,
}: {
  output: string;
  isAuthorEnabled: boolean;
  isCommitDateEnabled: boolean;
  isHashEnabled: boolean;
  isRefsEnabled: boolean;
  shouldHide: boolean;
}) {
  const onClick = (hash: string) => {
    return (event: any) => {
      if (event.key === '1') {
        navigator.clipboard.writeText(hash);
      }
    };
  };

  function formatToIsoWithoutSeconds(dateString: string): string {
    const date = new Date(dateString);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');

    const offsetMatch = dateString.match(/([+-])(\d{2})(\d{2})$/);
    let tz = 'UTC';

    if (offsetMatch) {
      const [, sign, hours] = offsetMatch;
      const totalOffset = `UTC${sign}${parseInt(hours, 10)}`;
      tz = totalOffset;
    }

    return `${yyyy}-${mm}-${dd} ${hh}:${mi} ${tz}`;
  }

  function extractRefsBlock(line: string) {
    const match = line.match(/\(([^)]+)\)(?=\s<.+?>\s\[\d{4}-\d{2}-\d{2})/);
    return match ? `(${match[1]})` : '';
  }

  return (
    <div
      style={{
        fontFamily: 'monospace',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {output.split('\n').map((line, idx) => {
        const parts = line.match(/(.*?)(\*)(.*)/); // Split around the *
        if (!parts) {
          // eslint-disable-next-line react/no-array-index-key
          return <div key={idx}>{line}</div>;
        }

        const regex =
          /^(.*?)(?: \(([^)]+)\))? <([^>]+)> \[([^\]]+)\]\s+([a-f0-9]{7,40})$/;
        const match = parts[3].match(regex);

        const [_, subject = '', refs = '', author = '', date = '', hash = ''] =
          match;

        return (
          <Dropdown
            menu={{ items, onClick: onClick(hash) }}
            trigger={['contextMenu']}
            overlayClassName="commit-dropdown"
            placement="bottom"
          >
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid,jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
            <a onClick={(e) => e.preventDefault()}>
              <div
                key={idx}
                className="commit-row"
                style={{ position: 'relative' }}
              >
                <span>{parts[1]}</span>
                <Tooltip
                  title={author}
                  placement="top"
                  mouseEnterDelay={0}
                  mouseLeaveDelay={0}
                >
                  <Avatar size={18} className="commit-author" gap={5}>
                    {author[0]}
                  </Avatar>
                </Tooltip>
                <span className="commit-msg">{subject}</span>
                {isRefsEnabled && refs && (
                  <Tag color="#6a737d" bordered={false}>
                    {refs}
                  </Tag>
                )}
                {!shouldHide && isAuthorEnabled && (
                  <strong
                    style={{
                      position: 'absolute',
                      right:
                        // eslint-disable-next-line no-nested-ternary
                        isHashEnabled && isCommitDateEnabled
                          ? '282px'
                          : // eslint-disable-next-line no-nested-ternary
                            isHashEnabled && !isCommitDateEnabled
                            ? '74px'
                            : !isHashEnabled && isCommitDateEnabled
                              ? '216px'
                              : '8px',
                    }}
                  >
                    {' '}
                    {`<${author}>`}
                  </strong>
                )}
                {!shouldHide && isCommitDateEnabled && (
                  <strong
                    style={{
                      position: 'absolute',
                      right: isHashEnabled ? '74px' : '8px',
                    }}
                  >
                    {' '}
                    {`[${formatToIsoWithoutSeconds(date)}]`}
                  </strong>
                )}
                {!shouldHide && isHashEnabled && (
                  <strong style={{ position: 'absolute', right: '8px' }}>
                    {' '}
                    {hash}
                  </strong>
                )}
              </div>
            </a>
          </Dropdown>
        );
      })}
    </div>
  );
}
