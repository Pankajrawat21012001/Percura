'use client';

import { useState, useRef, useEffect } from 'react';

const ACTION_CONFIG = {
    DISCOVERY: {
        label: 'DISCOVERED',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.12)',
        icon: '🔍',
        dotColor: '#3b82f6'
    },
    PEER_INFLUENCE: {
        label: 'WORD OF MOUTH',
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.12)',
        icon: '💬',
        dotColor: '#8b5cf6'
    },
    CHURN: {
        label: 'CHURNED',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.12)',
        icon: '💔',
        dotColor: '#ef4444'
    },
    CONVERSION: {
        label: 'CONVERTED',
        color: '#22c55e',
        bgColor: 'rgba(34, 197, 94, 0.12)',
        icon: '🎉',
        dotColor: '#22c55e'
    }
};

export default function SimulationTimeline({ weeklySnapshots = [], allEvents = [], totalWeeks = 8 }) {
    const scrollRef = useRef(null);
    const [expandedWeeks, setExpandedWeeks] = useState(new Set());

    // Auto-expand the latest week
    useEffect(() => {
        if (weeklySnapshots.length > 0) {
            const latestWeek = weeklySnapshots[weeklySnapshots.length - 1].week;
            setExpandedWeeks(prev => {
                const next = new Set(prev);
                next.add(latestWeek);
                return next;
            });
        }
    }, [weeklySnapshots.length]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [allEvents.length]);

    const toggleWeek = (week) => {
        setExpandedWeeks(prev => {
            const next = new Set(prev);
            if (next.has(week)) next.delete(week);
            else next.add(week);
            return next;
        });
    };

    // Skip week 0 (baseline)
    const activeSnapshots = weeklySnapshots.filter(s => s.week > 0);

    if (activeSnapshots.length === 0) {
        return (
            <div style={styles.emptyState}>
                <div style={styles.pulseRing}></div>
                <span style={styles.emptyText}>Waiting for simulation events...</span>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Header Stats */}
            <div style={styles.header}>
                <span style={styles.headerTitle}>SIMULATION TIMELINE</span>
                <div style={styles.headerStats}>
                    <span style={styles.statBadge}>
                        <span style={styles.statDot('#3b82f6')}></span>
                        {allEvents.filter(e => e.action === 'DISCOVERY').length} discoveries
                    </span>
                    <span style={styles.statBadge}>
                        <span style={styles.statDot('#22c55e')}></span>
                        {allEvents.filter(e => e.action === 'CONVERSION').length} conversions
                    </span>
                    <span style={styles.statBadge}>
                        <span style={styles.statDot('#ef4444')}></span>
                        {allEvents.filter(e => e.action === 'CHURN').length} churned
                    </span>
                </div>
            </div>

            {/* Timeline Feed */}
            <div style={styles.feed} ref={scrollRef}>
                <div style={styles.timelineAxis}></div>

                {activeSnapshots.map((snapshot) => {
                    const weekEvents = snapshot.events || [];
                    const isExpanded = expandedWeeks.has(snapshot.week);
                    const adoptionPct = (snapshot.overallAdoptionCurve * 100).toFixed(1);

                    return (
                        <div key={snapshot.week} style={styles.weekBlock}>
                            {/* Week Divider */}
                            <div 
                                style={styles.weekDivider} 
                                onClick={() => toggleWeek(snapshot.week)}
                            >
                                <div style={styles.weekDividerLine}></div>
                                <span style={styles.weekBadge}>
                                    Week {snapshot.week}
                                    <span style={styles.weekMeta}>
                                        {adoptionPct}% adoption • {weekEvents.length} events
                                    </span>
                                    <span style={styles.chevron(isExpanded)}>▾</span>
                                </span>
                                <div style={styles.weekDividerLine}></div>
                            </div>

                            {/* Week Stats Bar */}
                            <div style={styles.weekStats}>
                                <div style={styles.adoptionBar}>
                                    <div style={styles.adoptionBarFill(adoptionPct)}></div>
                                </div>
                                <div style={styles.weekCounters}>
                                    <span style={styles.counter('#22c55e')}>
                                        ✓ {snapshot.totalConverted || 0}
                                    </span>
                                    <span style={styles.counter('#ef4444')}>
                                        ✗ {snapshot.totalChurned || 0}
                                    </span>
                                    <span style={styles.counter('#94a3b8')}>
                                        ◎ {snapshot.totalActive || 0}
                                    </span>
                                </div>
                            </div>

                            {/* Event Cards */}
                            {isExpanded && weekEvents.length > 0 && (
                                <div style={styles.eventList}>
                                    {weekEvents.map((event, idx) => {
                                        const config = ACTION_CONFIG[event.action] || ACTION_CONFIG.DISCOVERY;
                                        return (
                                            <div key={event.id || idx} style={styles.eventCard}>
                                                <div style={styles.eventConnector}>
                                                    <div style={styles.eventDot(config.dotColor)}></div>
                                                    {idx < weekEvents.length - 1 && (
                                                        <div style={styles.eventLine}></div>
                                                    )}
                                                </div>
                                                <div style={styles.eventContent}>
                                                    <div style={styles.eventHeader}>
                                                        <div style={styles.agentInfo}>
                                                            <div style={styles.avatar(config.dotColor)}>
                                                                {(event.personaName || 'A')[0]}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={styles.agentName}>
                                                                    {event.personaName}
                                                                </span>
                                                                {(event.occupation || event.city) && (
                                                                    <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.4)', marginTop: '2px' }}>
                                                                        {event.occupation || 'Unknown'} • {event.city || 'Unknown'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={styles.actionBadge(config.color, config.bgColor)}>
                                                            {config.icon} {config.label}
                                                        </div>
                                                    </div>
                                                    <div style={styles.eventBody}>
                                                        {event.description}
                                                    </div>
                                                    <div style={styles.eventFooter}>
                                                        <span style={styles.segmentTag}>
                                                            {event.segmentName}
                                                        </span>
                                                        <span style={styles.sentimentTag(event.sentiment)}>
                                                            Sentiment: {(event.sentiment * 100).toFixed(0)}%
                                                            {event.sentimentDelta && parseFloat(event.sentimentDelta) !== 0 ? (
                                                                <span style={{ marginLeft: '4px', opacity: 0.8 }}>
                                                                    ({parseFloat(event.sentimentDelta) > 0 ? '↑' : '↓'} {Math.abs(event.sentimentDelta * 100).toFixed(0)}%)
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {isExpanded && weekEvents.length === 0 && (
                                <div style={styles.noEvents}>No events this week</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const styles = {
    container: {
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid rgba(0,0,0,0.06)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '600px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
    },
    header: {
        padding: '14px 18px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        background: '#FAFAFA'
    },
    headerTitle: {
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '1.5px',
        color: 'rgba(0,0,0,0.4)',
        fontFamily: "'JetBrains Mono', monospace"
    },
    headerStats: {
        display: 'flex',
        gap: '12px'
    },
    statBadge: {
        fontSize: '11px',
        color: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        fontWeight: '600'
    },
    statDot: (color) => ({
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: color,
        display: 'inline-block'
    }),
    feed: {
        flex: 1,
        overflowY: 'auto',
        padding: '12px 18px',
        position: 'relative',
        background: '#FFFFFF'
    },
    timelineAxis: {
        position: 'absolute',
        left: '30px',
        top: '0',
        bottom: '0',
        width: '1px',
        background: 'rgba(0,0,0,0.05)'
    },
    weekBlock: {
        marginBottom: '8px'
    },
    weekDivider: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        padding: '6px 0',
        userSelect: 'none'
    },
    weekDividerLine: {
        flex: 1,
        height: '1px',
        background: 'rgba(0,0,0,0.04)'
    },
    weekBadge: {
        fontSize: '12px',
        fontWeight: '700',
        color: 'rgba(0,0,0,0.7)',
        background: 'rgba(0,0,0,0.03)',
        padding: '4px 12px',
        borderRadius: '20px',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: '1px solid rgba(0,0,0,0.04)'
    },
    weekMeta: {
        fontSize: '10px',
        fontWeight: '400',
        color: 'rgba(0,0,0,0.3)',
        fontFamily: "'JetBrains Mono', monospace"
    },
    chevron: (isExpanded) => ({
        fontSize: '10px',
        transition: 'transform 0.2s',
        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
        color: 'rgba(0,0,0,0.3)'
    }),
    weekStats: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 0 4px',
        marginLeft: '12px'
    },
    adoptionBar: {
        flex: 1,
        height: '4px',
        background: 'rgba(0,0,0,0.05)',
        borderRadius: '2px',
        overflow: 'hidden'
    },
    adoptionBarFill: (pct) => ({
        width: `${Math.min(100, parseFloat(pct))}%`,
        height: '100%',
        background: 'linear-gradient(90deg, #3b82f6, #22c55e)',
        borderRadius: '2px',
        transition: 'width 0.5s ease'
    }),
    weekCounters: {
        display: 'flex',
        gap: '10px',
        fontSize: '11px',
        fontFamily: "'JetBrains Mono', monospace"
    },
    counter: (color) => ({
        color: color
    }),
    eventList: {
        padding: '4px 0 4px 12px'
    },
    eventCard: {
        display: 'flex',
        gap: '12px',
        marginBottom: '2px'
    },
    eventConnector: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '20px',
        flexShrink: 0
    },
    eventDot: (color) => ({
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: color,
        border: '2px solid #FFFFFF',
        zIndex: 1,
        flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }),
    eventLine: {
        width: '1px',
        flex: 1,
        background: 'rgba(0,0,0,0.06)',
        minHeight: '16px'
    },
    eventContent: {
        flex: 1,
        background: 'rgba(0,0,0,0.02)',
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '6px',
        border: '1px solid rgba(0,0,0,0.03)',
        transition: 'background 0.2s'
    },
    eventHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '6px',
        flexWrap: 'wrap',
        gap: '6px'
    },
    agentInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    avatar: (color) => ({
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: `${color}11`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: '700',
        border: `1px solid ${color}22`
    }),
    agentName: {
        fontSize: '13px',
        fontWeight: '600',
        color: 'rgba(0,0,0,0.8)'
    },
    actionBadge: (color, bgColor) => ({
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '0.8px',
        color: color,
        background: bgColor.replace('0.12', '0.08'),
        padding: '3px 8px',
        borderRadius: '4px',
        whiteSpace: 'nowrap'
    }),
    eventBody: {
        fontSize: '12px',
        color: 'rgba(0,0,0,0.5)',
        lineHeight: '1.5',
        marginBottom: '6px'
    },
    eventFooter: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap'
    },
    segmentTag: {
        fontSize: '10px',
        color: 'rgba(0,0,0,0.3)',
        background: 'rgba(0,0,0,0.04)',
        padding: '2px 7px',
        borderRadius: '3px'
    },
    sentimentTag: (sentiment) => ({
        fontSize: '10px',
        fontFamily: "'JetBrains Mono', monospace",
        color: sentiment >= 0.65 ? '#16a34a' : sentiment <= 0.3 ? '#dc2626' : '#d97706',
        background: sentiment >= 0.65 ? 'rgba(34,197,94,0.08)' : sentiment <= 0.3 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
        padding: '2px 7px',
        borderRadius: '3px',
        border: '1px solid currentColor',
        borderColor: 'inherit',
        opacity: 0.8
    }),
    noEvents: {
        fontSize: '11px',
        color: 'rgba(0,0,0,0.25)',
        textAlign: 'center',
        padding: '8px 0'
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '40px',
        color: 'rgba(0,0,0,0.3)'
    },
    emptyText: {
        fontSize: '13px',
        fontWeight: '500'
    },
    pulseRing: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: '2px solid rgba(59,130,246,0.2)',
        animation: 'pulse 1.5s ease infinite'
    }
};
