import ComparisonPage from './ComparisonPage';

type ComparePageProps = {
  params: {
    groupId: string;
  };
};

const ComparePage = ({ params }: ComparePageProps) => {
  return <ComparisonPage groupId={params.groupId} />;
};

export default ComparePage;
