import { useTranslation } from 'react-i18next';
import { Card, Typography, Button } from 'antd';
import { AiOutlineAppstore } from 'react-icons/ai';
import { memo, useEffect } from 'react';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { artifactGalleryData } from './data';

const { Title, Paragraph } = Typography;

interface ArtifactGalleryProps {
  maxItems?: number;
  showViewMore?: boolean;
  title?: string;
  description?: string;
  showHeader?: boolean;
}

const ArtifactGallery = memo(
  ({
    maxItems = 8,
    showViewMore = true,
    title,
    description,
    showHeader = true,
  }: ArtifactGalleryProps) => {
    const { i18n } = useTranslation();

    const { setCollapse } = useSiderStoreShallow((state) => ({
      collapse: state.collapse,
      setCollapse: state.setCollapse,
    }));

    // Force collapse by default
    useEffect(() => {
      setCollapse(true);
    }, [setCollapse]);

    // Default header configuration
    const defaultHeader = {
      tag: 'Refly Artifacts Gallery',
      tagIcon: <AiOutlineAppstore />,
      title: {
        'zh-CN': 'Refly 生成作品展示',
        en: 'Refly Artifacts Gallery',
      },
      description: {
        'zh-CN': '探索和发现 Refly 生成式画布生成的精彩作品',
        en: 'Discover and explore incredible artifacts created with Refly Genertive Canvas',
      },
      color: '#333333',
      tagShadow:
        '0 3px 20px 0 rgba(0,0,0,0.10), 0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(227,227,227,0.50)',
    };

    // Get current language
    const currentLang = i18n.language as 'zh-CN' | 'en';
    console.log('currentLang', currentLang);

    // Limit the number of artifacts to display
    const displayedArtifacts = artifactGalleryData.slice(0, maxItems);

    return (
      <section
        className={`relative mx-auto ${
          showHeader ? 'mt-[98px]' : ''
        } max-w-7xl px-4 py-16 sm:px-6 sm:py-24`}
      >
        {/* Header Section */}
        {showHeader ? (
          <div className="mb-16 text-center">
            <span
              className="mb-8 inline-flex items-center justify-center rounded-lg border border-solid border-black/10 bg-white px-6 py-2 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-sm"
              style={{
                color: defaultHeader.color,
                boxShadow: defaultHeader.tagShadow,
              }}
            >
              <span className="mr-2 flex items-center" style={{ color: defaultHeader.color }}>
                {defaultHeader.tagIcon}
              </span>
              <span>{defaultHeader.tag}</span>
            </span>
            <section className="text-center">
              <Title
                level={2}
                className="font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif]"
              >
                <div className="mt-2">
                  <span className="relative text-[#333333]">
                    {title || defaultHeader.title[currentLang]}
                    <span className="absolute bottom-0 left-0 h-1 w-full bg-[#333333]" />
                  </span>
                </div>
              </Title>
              <Paragraph className="mx-auto mt-4 max-w-3xl text-center text-gray-500">
                {description || defaultHeader.description[currentLang]}
              </Paragraph>
            </section>
          </div>
        ) : null}

        {/* Artifacts Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {displayedArtifacts.map((artifact) => (
            <a
              key={artifact.id}
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline text-inherit"
            >
              <Card
                className="group overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer h-full"
                bodyStyle={{ padding: 0 }}
                cover={
                  <div className="relative h-48 w-full overflow-hidden">
                    <img
                      src={artifact.coverImage}
                      alt={artifact.title[currentLang]}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                }
              >
                <div className="p-6 flex flex-col h-[calc(100%-12rem)]">
                  <Title
                    level={4}
                    className="!mb-2 !mt-0 line-clamp-2"
                    style={{ color: '#333333' }}
                  >
                    {artifact.title[currentLang]}
                  </Title>
                  {artifact.description && (
                    <Paragraph className="!mb-4 text-gray-600 line-clamp-2 flex-grow">
                      {artifact.description[currentLang]}
                    </Paragraph>
                  )}
                  <div className="text-sm text-gray-400 mt-auto">
                    From {artifact.authorEmail || 'Anonymous'}
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>

        {/* View More Button */}
        {showViewMore && (
          <div className="mt-12 text-center">
            <Button
              type="primary"
              shape="round"
              size="large"
              className="px-8 py-2 no-underline"
              style={{ backgroundColor: '#333333' }}
              href="/artifact-gallery"
            >
              {currentLang === 'zh-CN' ? '探索更多 Spaces' : 'Explore more Spaces'} 👉
            </Button>
          </div>
        )}
      </section>
    );
  },
);

export default ArtifactGallery;
