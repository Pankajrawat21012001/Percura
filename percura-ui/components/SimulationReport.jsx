'use client';

import { useState } from 'react';

export default function SimulationReport({ report, weeklySnapshots = [] }) {
    const [collapsedSections, setCollapsedSections] = useState(new Set());

    if (!report) return null;

    const toggleSection = (idx) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    // Build structured sections from the flat report
    const sections = buildSections(report, weeklySnapshots);

    const verdictColor = {
        'Strong Launch Signal': '#22c55e',
        'Niche Opportunity': '#f59e0b',
        'Pivot Required': '#ef4444',
        'Premature Market': '#8b5cf6'
    }[report.finalVerdict] || '#94a3b8';

    return (
        <div style={styles.container}>
            {/* Report Header */}
            <div style={styles.reportHeader}>
                <div style={styles.reportMeta}>
                    <span style={styles.reportTag}>BEHAVIORAL SIMULATION REPORT</span>
                </div>
                <div style={styles.verdictRow}>
                    <span style={styles.verdictBadge(verdictColor)}>
                        {report.finalVerdict || 'Analysis Complete'}
                    </span>
                    <span style={styles.trajectory}>
                        {report.adoptionTrajectory}
                    </span>
                </div>
                <div style={styles.headerDivider}></div>
            </div>

            {/* Sections */}
            <div style={styles.sectionsList}>
                {sections.map((section, idx) => {
                    const isCollapsed = collapsedSections.has(idx);
                    return (
                        <div key={idx} style={styles.sectionItem}>
                            <div 
                                style={styles.sectionHeader} 
                                onClick={() => toggleSection(idx)}
                            >
                                <span style={styles.sectionNumber}>
                                    {String(idx + 1).padStart(2, '0')}
                                </span>
                                <h3 style={styles.sectionTitle}>{section.title}</h3>
                                <span style={styles.collapseIcon(isCollapsed)}>▾</span>
                            </div>
                            {!isCollapsed && (
                                <div style={styles.sectionBody}>
                                    {section.content}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function buildSections(report, weeklySnapshots) {
    const sections = [];

    // Section 1: Adoption Curve
    const lastSnapshot = weeklySnapshots[weeklySnapshots.length - 1];
    sections.push({
        title: 'Adoption Curve',
        content: (
            <div>
                <div style={styles.curveGrid}>
                    {weeklySnapshots.filter(s => s.week > 0).map(s => (
                        <div key={s.week} style={styles.curveBar}>
                            <div style={styles.curveBarInner((s.overallAdoptionCurve * 100))}></div>
                            <span style={styles.curveLabel}>W{s.week}</span>
                            <span style={styles.curvePct}>
                                {(s.overallAdoptionCurve * 100).toFixed(0)}%
                            </span>
                        </div>
                    ))}
                </div>
                {lastSnapshot && (
                    <div style={styles.curveStats}>
                        <div style={styles.curveStat}>
                            <span style={styles.curveStatValue('#22c55e')}>
                                {lastSnapshot.totalConverted || 0}
                            </span>
                            <span style={styles.curveStatLabel}>Converted</span>
                        </div>
                        <div style={styles.curveStat}>
                            <span style={styles.curveStatValue('#ef4444')}>
                                {lastSnapshot.totalChurned || 0}
                            </span>
                            <span style={styles.curveStatLabel}>Churned</span>
                        </div>
                        <div style={styles.curveStat}>
                            <span style={styles.curveStatValue('#94a3b8')}>
                                {lastSnapshot.totalActive || 0}
                            </span>
                            <span style={styles.curveStatLabel}>Still Active</span>
                        </div>
                    </div>
                )}
            </div>
        )
    });

    // Section 2: Segment Ranking
    if (report.segmentRanking?.length > 0) {
        sections.push({
            title: 'Segment Ranking',
            content: (
                <div style={styles.rankingList}>
                    {report.segmentRanking.map((seg, i) => (
                        <div key={i} style={styles.rankingItem}>
                            <span style={styles.rankBadge(i)}>#{seg.rank || i + 1}</span>
                            <div style={styles.rankContent}>
                                <span style={styles.rankName}>{seg.segmentName}</span>
                                <span style={styles.rankReason}>{seg.reasoning}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )
        });
    }

    // Section 3: Key Turning Points
    if (report.keyTurningPoints?.length > 0) {
        sections.push({
            title: 'Key Turning Points',
            content: (
                <div style={styles.turningPoints}>
                    {report.keyTurningPoints.map((tp, i) => (
                        <div key={i} style={styles.turningPoint}>
                            <span style={styles.tpWeek}>Week {tp.week}</span>
                            <span style={styles.tpEvent}>{tp.event}</span>
                        </div>
                    ))}
                </div>
            )
        });
    }

    // Section 4: Launch Recommendations
    if (report.launchRecommendations?.length > 0) {
        sections.push({
            title: 'Launch Recommendations',
            content: (
                <div style={styles.recommendations}>
                    {report.launchRecommendations.map((rec, i) => (
                        <div key={i} style={styles.recItem}>
                            <span style={styles.recNumber}>{i + 1}</span>
                            <span style={styles.recText}>{rec}</span>
                        </div>
                    ))}
                </div>
            )
        });
    }

    // Section 5: Per-Segment Detail
    if (lastSnapshot?.segmentSnapshots?.length > 0) {
        sections.push({
            title: 'Segment Detail View',
            content: (
                <div style={styles.segmentDetail}>
                    {lastSnapshot.segmentSnapshots.map((seg, i) => (
                        <div key={i} style={styles.segDetailCard}>
                            <div style={styles.segDetailHeader}>
                                <span style={styles.segDetailName}>{seg.segmentName}</span>
                                <span style={styles.segDetailSentiment(seg.avgSentiment)}>
                                    Avg sentiment: {(seg.avgSentiment * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div style={styles.segDetailStats}>
                                <span style={{ color: '#22c55e' }}>✓ {seg.convertedCount}</span>
                                <span style={{ color: '#ef4444' }}>✗ {seg.churnedCount}</span>
                                <span style={{ color: '#94a3b8' }}>◎ {seg.activeCount}</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                                    / {seg.totalPersonas} total
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )
        });
    }

    return sections;
}

const styles = {
    container: {
        background: '#0f1117',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden'
    },
    reportHeader: {
        padding: '20px 24px 16px'
    },
    reportMeta: {
        marginBottom: '12px'
    },
    reportTag: {
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '1.5px',
        color: 'rgba(255,255,255,0.4)',
        fontFamily: "'JetBrains Mono', monospace"
    },
    verdictRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap'
    },
    verdictBadge: (color) => ({
        fontSize: '16px',
        fontWeight: '800',
        color: color,
        background: `${color}18`,
        padding: '6px 16px',
        borderRadius: '6px',
        border: `1px solid ${color}30`
    }),
    trajectory: {
        fontSize: '13px',
        color: 'rgba(255,255,255,0.5)',
        fontStyle: 'italic'
    },
    headerDivider: {
        height: '1px',
        background: 'rgba(255,255,255,0.06)',
        marginTop: '16px'
    },
    sectionsList: {
        padding: '0 8px 8px'
    },
    sectionItem: {
        margin: '4px 0',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)'
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        cursor: 'pointer',
        background: 'rgba(255,255,255,0.02)',
        transition: 'background 0.15s'
    },
    sectionNumber: {
        fontSize: '12px',
        fontWeight: '700',
        color: 'rgba(255,255,255,0.2)',
        fontFamily: "'JetBrains Mono', monospace",
        width: '24px'
    },
    sectionTitle: {
        fontSize: '14px',
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        margin: 0,
        flex: 1
    },
    collapseIcon: (isCollapsed) => ({
        fontSize: '12px',
        color: 'rgba(255,255,255,0.25)',
        transition: 'transform 0.2s',
        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
    }),
    sectionBody: {
        padding: '12px 16px 16px',
        borderTop: '1px solid rgba(255,255,255,0.04)'
    },
    curveGrid: {
        display: 'flex',
        gap: '6px',
        alignItems: 'flex-end',
        height: '80px',
        marginBottom: '16px'
    },
    curveBar: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        justifyContent: 'flex-end',
        gap: '4px'
    },
    curveBarInner: (pct) => ({
        width: '100%',
        height: `${Math.max(4, pct)}%`,
        background: 'linear-gradient(180deg, #22c55e, #3b82f6)',
        borderRadius: '3px 3px 0 0',
        transition: 'height 0.5s ease',
        minHeight: '4px'
    }),
    curveLabel: {
        fontSize: '9px',
        color: 'rgba(255,255,255,0.3)',
        fontFamily: "'JetBrains Mono', monospace"
    },
    curvePct: {
        fontSize: '9px',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: '600'
    },
    curveStats: {
        display: 'flex',
        gap: '20px'
    },
    curveStat: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
    },
    curveStatValue: (color) => ({
        fontSize: '20px',
        fontWeight: '800',
        color: color,
        fontFamily: "'JetBrains Mono', monospace"
    }),
    curveStatLabel: {
        fontSize: '10px',
        color: 'rgba(255,255,255,0.35)'
    },
    rankingList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    rankingItem: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
    },
    rankBadge: (i) => ({
        fontSize: '12px',
        fontWeight: '800',
        color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#b45309',
        fontFamily: "'JetBrains Mono', monospace",
        width: '28px',
        flexShrink: 0,
        paddingTop: '2px'
    }),
    rankContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '3px'
    },
    rankName: {
        fontSize: '13px',
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)'
    },
    rankReason: {
        fontSize: '12px',
        color: 'rgba(255,255,255,0.45)',
        lineHeight: '1.5'
    },
    turningPoints: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    turningPoint: {
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
    },
    tpWeek: {
        fontSize: '11px',
        fontWeight: '700',
        color: '#3b82f6',
        fontFamily: "'JetBrains Mono', monospace",
        background: 'rgba(59,130,246,0.1)',
        padding: '3px 8px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        flexShrink: 0
    },
    tpEvent: {
        fontSize: '12px',
        color: 'rgba(255,255,255,0.6)',
        lineHeight: '1.5'
    },
    recommendations: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    recItem: {
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
    },
    recNumber: {
        fontSize: '12px',
        fontWeight: '800',
        color: '#22c55e',
        fontFamily: "'JetBrains Mono', monospace",
        background: 'rgba(34,197,94,0.1)',
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        flexShrink: 0
    },
    recText: {
        fontSize: '12px',
        color: 'rgba(255,255,255,0.65)',
        lineHeight: '1.6',
        paddingTop: '3px'
    },
    segmentDetail: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    segDetailCard: {
        background: 'rgba(255,255,255,0.03)',
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.05)'
    },
    segDetailHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
        flexWrap: 'wrap',
        gap: '6px'
    },
    segDetailName: {
        fontSize: '13px',
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)'
    },
    segDetailSentiment: (sentiment) => ({
        fontSize: '10px',
        fontFamily: "'JetBrains Mono', monospace",
        color: sentiment >= 0.6 ? '#22c55e' : sentiment <= 0.35 ? '#ef4444' : '#f59e0b'
    }),
    segDetailStats: {
        display: 'flex',
        gap: '14px',
        fontSize: '12px',
        fontFamily: "'JetBrains Mono', monospace"
    }
};
