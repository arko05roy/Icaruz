'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export interface NetworkNode {
  id: string;
  /** Display label (e.g., "defi.brainpedia.eth"). */
  label: string;
  kind: 'agent' | 'orchestrator' | 'brain';
  /** Highlight strength (0–1). Drives the node's fill. */
  active?: number;
}

export interface NetworkLink {
  source: string;
  target: string;
  /** "request" pulses outward from source; "response" pulses back. */
  kind: 'request' | 'response';
  active?: number;
}

interface Props {
  nodes: NetworkNode[];
  links: NetworkLink[];
  height?: number;
}

const NODE_COLORS: Record<NetworkNode['kind'], string> = {
  agent: '#6366f1',
  orchestrator: '#0ea5e9',
  brain: '#10b981',
};

export function NetworkViz({ nodes, links, height = 480 }: Props) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = d3.select(ref.current);
    if (!svg.node()) return;
    const { width } = (svg.node() as SVGSVGElement).getBoundingClientRect();
    svg.selectAll('*').remove();

    type SimNode = NetworkNode & d3.SimulationNodeDatum;
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks = links.map((l) => ({ ...l })) as unknown as d3.SimulationLinkDatum<SimNode>[];

    const sim = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>(simLinks)
          .id((d) => d.id)
          .distance(120)
          .strength(0.6),
      )
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg
      .append('g')
      .attr('stroke-opacity', 0.35)
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (d) => ((d as unknown as NetworkLink).kind === 'request' ? '#0ea5e9' : '#10b981'))
      .attr('stroke-width', (d) => 1 + ((d as unknown as NetworkLink).active ?? 0) * 3);

    const node = svg
      .append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g');

    node
      .append('circle')
      .attr('r', (d) => (d.kind === 'orchestrator' ? 14 : d.kind === 'agent' ? 12 : 10))
      .attr('fill', (d) => NODE_COLORS[d.kind])
      .attr('fill-opacity', (d) => 0.4 + (d.active ?? 0) * 0.6)
      .attr('stroke', (d) => NODE_COLORS[d.kind])
      .attr('stroke-width', 1.5);

    node
      .append('text')
      .attr('dy', '1.6em')
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('fill', 'currentColor')
      .text((d) => d.label);

    sim.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      sim.stop();
    };
  }, [nodes, links, height]);

  return (
    <svg
      ref={ref}
      width="100%"
      height={height}
      style={{ display: 'block' }}
      role="img"
      aria-label="Brainpedia agent network"
    />
  );
}
