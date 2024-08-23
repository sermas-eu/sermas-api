import { flattenSVG } from 'flatten-svg';
//import { createSVGWindow } from 'svgdom';
// let createSVGWindow = await import("svgdom");

export interface SvgPath {
    id: string
    points: [number, number][],
    stroke: string
    groupId: string | null
}

export const getSvgPaths = async (
    svg: string | Buffer,
    tag = 'desc',
    tagContentMatch = 'navigation-space',
): Promise<SvgPath[]> => {


    const createSVGWindow = await import('svgdom');
    let window = createSVGWindow()
    window.document.documentElement.innerHTML = svg

    const doc = window.document.documentElement as SVGElement

    const areasList: SVGElement[] = []
    Array.from(doc.querySelectorAll(tag)).forEach((desc) => {
        if (desc.textContent?.indexOf(tagContentMatch) === -1) return
        if (!desc.parentNode) return
        areasList.push(desc.parentNode as unknown as SVGElement)
    })

    // update with filtered paths
    window = createSVGWindow()
    window.document.documentElement.append(...areasList)

    const svgPaths: SvgPath[] = flattenSVG(window.document.documentElement)

    svgPaths.forEach((svgPath, i) => {
        svgPath.id = areasList[i].id
    })

    return svgPaths
}