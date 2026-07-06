// graph.js - Knowledge Graph renderer

function renderKnowledgeGraph() {
    const container = document.getElementById('graphContainer');
    if (!container) return;

    if (typeof cytoscape === 'undefined') {
        console.warn('Cytoscape not loaded yet, retrying...');
        setTimeout(renderKnowledgeGraph, 500);
        return;
    }

    const nodes = [];
    const edges = [];

    // Use Object.values(hubState.folders) to iterate
    Object.values(hubState.folders).forEach(folder => {
        nodes.push({
            data: {
                id: folder.id,
                label: folder.title,
                type: 'folder'
            }
        });

        if (folder.children) {
            folder.children.forEach(childId => {
                if (childId.startsWith('page_')) {
                    const pageId = childId.replace('page_', '');
                    const page = hubState.pages[pageId];
                    if (!page) return;

                    nodes.push({
                        data: {
                            id: pageId,
                            label: page.title,
                            type: 'page'
                        }
                    });

                    edges.push({
                        data: {
                            id: `edge-${folder.id}-${pageId}`,
                            source: folder.id,
                            target: pageId
                        }
                    });
                }
            });
        }
    });

    // Add Backlink Edges (scan for [[Page Title]] patterns)
    const backlinkEdges = new Set();

    Object.values(hubState.folders).forEach(folder => {
        if (!folder.children) return;
        folder.children.forEach(childId => {
            if (!childId.startsWith('page_')) return;
            const sourcePageId = childId.replace('page_', '');
            const sourcePage = hubState.pages[sourcePageId];
            if (!sourcePage) return;

            // Scan all blocks in this page for [[...]] references
            sourcePage.blocks.forEach(block => {
                if (!block.content) return;

                const linkPattern = /\[\[(.*?)\]\]/g;
                let match;
                while ((match = linkPattern.exec(block.content)) !== null) {
                    const referencedTitle = match[1].trim();

                    // Find the page with this title
                    let targetPageId = null;
                    Object.values(hubState.folders).forEach(f => {
                        if (!f.children) return;
                        f.children.forEach(cid => {
                            if (!cid.startsWith('page_')) return;
                            const pid = cid.replace('page_', '');
                            const p = hubState.pages[pid];
                            if (p && p.title.toLowerCase() === referencedTitle.toLowerCase()) {
                                targetPageId = pid;
                            }
                        });
                    });

                    if (targetPageId && targetPageId !== sourcePageId) {
                        const edgeId = `backlink-${sourcePageId}-${targetPageId}`;
                        if (!backlinkEdges.has(edgeId)) {
                            backlinkEdges.add(edgeId);
                            edges.push({
                                data: {
                                    id: edgeId,
                                    source: sourcePageId,
                                    target: targetPageId,
                                    type: 'backlink'
                                }
                            });
                        }
                    }
                }
            });
        });
    });

    if (nodes.length === 0) {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:1.1rem;">Create some folders and pages in the Lessons view to see your graph!</div>`;
        return;
    }

    const cy = cytoscape({
        container: container,
        elements: { nodes, edges },
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'background-color': 'data(type) === "folder" ? "#7c6df0" : "#38bdf8"',
                    'color': '#ffffff',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': '12px',
                    'font-weight': '600',
                    'width': 'data(type) === "folder" ? 50 : 40',
                    'height': 'data(type) === "folder" ? 50 : 40',
                    'border-width': 2,
                    'border-color': 'rgba(255,255,255,0.2)',
                    'shadow-blur': 10,
                    'shadow-color': 'rgba(0,0,0,0.3)'
                }
            },
            {
                selector: 'node[type="folder"]',
                style: {
                    'shape': 'rectangle',
                    'background-color': '#7c6df0'
                }
            },
            {
                selector: 'node[type="page"]',
                style: {
                    'shape': 'ellipse',
                    'background-color': '#38bdf8'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#64748b',
                    'curve-style': 'bezier',
                    'target-arrow-color': '#64748b',
                    'target-arrow-shape': 'triangle',
                    'opacity': 0.7
                }
            },
            {
                selector: 'edge[type="backlink"]',
                style: {
                    'width': 2,
                    'line-color': '#a855f7',
                    'curve-style': 'bezier',
                    'target-arrow-color': '#a855f7',
                    'target-arrow-shape': 'triangle',
                    'opacity': 0.6,
                    'line-style': 'dashed'
                }
            }
        ],
        layout: {
            name: 'cose',
            idealEdgeLength: 120,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 30,
            randomize: false,
            componentSpacing: 100,
            nodeRepulsion: 450000,
            edgeElasticity: 100,
            nestingFactor: 0.1,
            gravity: 0.25,
            numIter: 1000,
            tile: true
        }
    });

    cy.on('tap', 'node', function(evt) {
        const nodeId = evt.target.id();
        const page = hubState.pages[nodeId];

        if (page) {
            hubState.activePageId = nodeId;
            refreshWorkspace();
            switchView('lessons-view');
        } else {
            const label = evt.target.data('label');
            showToast(`📁 Folder: ${label}`, 'info');
        }
    });

    const resizeHandler = () => {
        if (cy) cy.fit();
    };
    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);

    container._cy = cy;
}
