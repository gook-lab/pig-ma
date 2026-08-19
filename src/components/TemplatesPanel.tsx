import { useState, useMemo, memo, useCallback } from "react";
import {
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  LayoutTemplate,
  Trash2,
  User,
} from "lucide-react";
import { useCanvasStore } from "@/store";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Z_SIDE_PANEL } from "@/constants/zIndex";
import { DEFAULT_TEMPLATES, TEMPLATE_CATEGORIES } from "@/data/templates";
import { searchTemplates, generateTemplateThumbnail } from "@/utils/templates";
import type { TemplateDefinition, TemplateCategory } from "@/types";

// ============================================================================
// Template Thumbnail Component
// ============================================================================

const TemplateThumbnail = memo(function TemplateThumbnail({
  template,
}: {
  template: TemplateDefinition;
}) {
  const svgContent = useMemo(
    () => generateTemplateThumbnail(template, { width: 120, height: 80 }),
    [template],
  );

  return (
    <div
      className="h-20 w-full overflow-hidden rounded-lg bg-gray-50"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
});

// ============================================================================
// Template Card Component
// ============================================================================

interface TemplateCardProps {
  template: TemplateDefinition;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

const TemplateCard = memo(function TemplateCard({
  template,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: TemplateCardProps) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-2 rounded-xl p-2",
        "border-2 border-gray-100 transition-all",
        "hover:border-violet-300 hover:bg-violet-50/50",
      )}
    >
      <TemplateThumbnail template={template} />
      <div className="flex items-start justify-between gap-1 px-1">
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-xs font-medium text-gray-800">
            {template.name}
          </p>
          <p className="line-clamp-2 text-[10px] break-words text-gray-500">
            {template.description}
          </p>
        </div>
        <button
          onClick={onToggleFavorite}
          className={cn(
            "rounded p-1 transition-opacity",
            "hover:bg-yellow-100",
            isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Star
            className={cn(
              "h-3.5 w-3.5",
              isFavorite
                ? "fill-yellow-500 text-yellow-500"
                : "stroke-2 text-gray-400",
            )}
          />
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// Templates Panel Component
// ============================================================================

export function TemplatesPanel() {
  const {
    showTemplatesPanel,
    setShowTemplatesPanel,
    favoriteTemplates,
    toggleFavoriteTemplate,
    recentTemplates,
    addRecentTemplate,
    applyTemplate,
    viewport,
    customTemplates,
    deleteCustomTemplate,
  } = useCanvasStore();

  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    favorites: true,
    recent: true,
    custom: true,
    flowchart: true,
    wireframe: true,
    orgChart: true,
    mindMap: true,
    kanban: true,
    timeline: true,
    brainstorm: true,
    retro: true,
    todo: true,
  });

  // Filter templates by search query (including custom templates)
  const filteredTemplates = useMemo(() => {
    const defaultFiltered = searchTemplates(search);
    if (!search.trim()) return defaultFiltered;

    // Include custom templates in search
    const searchLower = search.toLowerCase();
    const customFiltered = customTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(searchLower)),
    );
    return [...defaultFiltered, ...customFiltered];
  }, [search, customTemplates]);

  // Group templates by category (excluding custom - shown separately)
  const templatesByCategory = useMemo(() => {
    const grouped: Record<
      Exclude<TemplateCategory, "custom">,
      TemplateDefinition[]
    > = {
      flowchart: [],
      wireframe: [],
      orgChart: [],
      mindMap: [],
      kanban: [],
      timeline: [],
      brainstorm: [],
      retro: [],
      todo: [],
    };

    for (const template of filteredTemplates) {
      // Skip custom templates - they're shown in "My Templates" section
      if (template.category === "custom") continue;
      grouped[template.category].push(template);
    }

    return grouped;
  }, [filteredTemplates]);

  // Combine all templates for lookup
  const allTemplates = useMemo(
    () => [...DEFAULT_TEMPLATES, ...customTemplates],
    [customTemplates],
  );

  // Get favorite templates
  const favorites = useMemo(() => {
    return allTemplates.filter((t) => favoriteTemplates.includes(t.id));
  }, [allTemplates, favoriteTemplates]);

  // Get recent templates
  const recents = useMemo(() => {
    return recentTemplates
      .map((id) => allTemplates.find((t) => t.id === id))
      .filter(Boolean) as TemplateDefinition[];
  }, [allTemplates, recentTemplates]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  }, []);

  const handleSelectTemplate = useCallback(
    (template: TemplateDefinition) => {
      // Calculate canvas center position
      const canvasWidth =
        typeof window !== "undefined" ? window.innerWidth : 1920;
      const canvasHeight =
        typeof window !== "undefined" ? window.innerHeight : 1080;
      const centerX = (canvasWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (canvasHeight / 2 - viewport.y) / viewport.zoom;

      // Apply template at canvas center
      applyTemplate(template, { x: centerX, y: centerY });
      addRecentTemplate(template.id);
    },
    [applyTemplate, addRecentTemplate, viewport],
  );

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent, templateId: string) => {
      e.stopPropagation();
      toggleFavoriteTemplate(templateId);
    },
    [toggleFavoriteTemplate],
  );

  const handleDeleteCustomTemplate = useCallback(
    (e: React.MouseEvent, templateId: string) => {
      e.stopPropagation();
      deleteCustomTemplate(templateId);
    },
    [deleteCustomTemplate],
  );

  if (!showTemplatesPanel) return null;

  return (
    <div
      className="fixed left-4 flex w-72 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-[#c0c1c4] dark:bg-[#d6d7da]"
      style={{
        top: "76px",
        height: "calc(100% - 176px)",
        zIndex: Z_SIDE_PANEL,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-[#c0c1c4]">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-5 w-5 text-violet-600" />
          <h2 className="font-semibold text-gray-800 dark:text-gray-800">
            Templates
          </h2>
        </div>
        <button
          onClick={() => setShowTemplatesPanel(false)}
          className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
        >
          <X className="h-5 w-5 text-gray-500 dark:text-gray-600" />
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-gray-200 p-3 dark:border-[#c0c1c4]">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates"
            className="pr-3 pl-9"
          />
        </div>
      </div>

      {/* Template Categories */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        {/* Favorites Section */}
        {favorites.length > 0 && !search.trim() && (
          <div className="border-b border-gray-100">
            <button
              onClick={() => toggleCategory("favorites")}
              className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                Favorites
                <span className="text-xs text-gray-400">
                  ({favorites.length})
                </span>
              </span>
              {expandedCategories.favorites ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {expandedCategories.favorites && (
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                {favorites.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isFavorite={true}
                    onSelect={() => handleSelectTemplate(template)}
                    onToggleFavorite={(e) =>
                      handleToggleFavorite(e, template.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Section */}
        {recents.length > 0 && !search.trim() && (
          <div className="border-b border-gray-100">
            <button
              onClick={() => toggleCategory("recent")}
              className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Clock className="h-4 w-4 text-gray-500" />
                Recent
              </span>
              {expandedCategories.recent ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {expandedCategories.recent && (
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                {recents.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isFavorite={favoriteTemplates.includes(template.id)}
                    onSelect={() => handleSelectTemplate(template)}
                    onToggleFavorite={(e) =>
                      handleToggleFavorite(e, template.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Templates Section (Custom) */}
        {customTemplates.length > 0 && !search.trim() && (
          <div className="border-b border-gray-100">
            <button
              onClick={() => toggleCategory("custom")}
              className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <User className="h-4 w-4 text-violet-500" />
                My Templates
                <span className="text-xs text-gray-400">
                  ({customTemplates.length})
                </span>
              </span>
              {expandedCategories.custom ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {expandedCategories.custom && (
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                {customTemplates.map((template) => (
                  <div key={template.id} className="group relative">
                    <TemplateCard
                      template={template}
                      isFavorite={favoriteTemplates.includes(template.id)}
                      onSelect={() => handleSelectTemplate(template)}
                      onToggleFavorite={(e) =>
                        handleToggleFavorite(e, template.id)
                      }
                    />
                    <button
                      onClick={(e) =>
                        handleDeleteCustomTemplate(e, template.id)
                      }
                      className={cn(
                        "absolute top-2 right-2 rounded p-1 transition-opacity",
                        "bg-red-100 hover:bg-red-200",
                        "opacity-0 group-hover:opacity-100",
                      )}
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category Sections */}
        {TEMPLATE_CATEGORIES.filter((c) => c.id !== "custom").map(
          (category) => {
            const templates =
              templatesByCategory[
                category.id as Exclude<TemplateCategory, "custom">
              ];
            if (templates.length === 0) return null;

            return (
              <div key={category.id} className="border-b border-gray-100">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {category.label}
                    <span className="ml-2 text-xs text-gray-400">
                      ({templates.length})
                    </span>
                  </span>
                  {expandedCategories[category.id] ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                {expandedCategories[category.id] && (
                  <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                    {templates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        isFavorite={favoriteTemplates.includes(template.id)}
                        onSelect={() => handleSelectTemplate(template)}
                        onToggleFavorite={(e) =>
                          handleToggleFavorite(e, template.id)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          },
        )}

        {/* Empty state */}
        {filteredTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <LayoutTemplate className="mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm text-gray-500">No templates found</p>
            <p className="mt-1 text-xs text-gray-400">
              Try a different search term
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
