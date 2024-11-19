import { CanvasNode, CanvasNodeType } from '../node';
import { ResponseNodePreview } from './response';
import { ResourceNodePreview } from './resource';
import { SkillNodePreview } from './skill';
import { ToolNodePreview } from './tool';
import { DocumentNodePreview } from './document';

export const NodePreview = (props: { node: CanvasNode; handleClosePanel: () => void }) => {
  const { node, handleClosePanel } = props;

  const previewComponent = (nodeType: CanvasNodeType) => {
    switch (nodeType) {
      case 'resource':
        return <ResourceNodePreview />;
      case 'document':
        return <DocumentNodePreview />;
      case 'skill':
        return <SkillNodePreview />;
      case 'tool':
        return <ToolNodePreview />;
      case 'response':
        return <ResponseNodePreview />;
      default:
        return null;
    }
  };

  return (
    <div className="absolute top-1 right-4 w-1/3 min-w-96 h-[95%] m-3 bg-white rounded-lg shadow-lg p-4 z-10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Node Preview</h3>
        <button onClick={handleClosePanel} className="text-gray-500 hover:text-gray-700">
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      {previewComponent(node.type)}
    </div>
  );
};
