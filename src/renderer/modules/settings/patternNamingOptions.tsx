import Title from '../../components/Title';

const options = [
  {
    label: (
      <Title title="{repo}__wt__{branch}" example="my-app__wt__feature-login" />
    ),
    value: '{repo}__wt__{branch}',
  },
  {
    label: <Title title="{repo}__{branch}" example="my-app__feature-login" />,
    value: '{repo}__{branch}',
  },
  {
    label: (
      <Title title="{repo}-wt-{branch}" example="my-app-wt-feature-login" />
    ),
    value: '{repo}-wt-{branch}',
  },
  {
    label: (
      <Title title="wt__{repo}__{branch}" example="wt__my-app__feature-login" />
    ),
    value: 'wt__{repo}__{branch}',
  },
];
export default options;
