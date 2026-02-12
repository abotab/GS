/**
 * محرك الرسوميات - Graphics Engine
 * يستخدم PixiJS للرسم عالي الأداء
 */

interface Point {
    x: number;
    y: number;
}

interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

class GraphicsEngine {
    private app: PIXI.Application;
    private viewport: Viewport = { x: 0, y: 0, zoom: 1 };
    private mainContainer: PIXI.Container;
    private gridContainer: PIXI.Container;
    private bonesContainer: PIXI.Container;
    private characterContainer: PIXI.Container;
    private isGridVisible: boolean = true;
    private canvasElement: HTMLElement;
    
    // الأحداث
    public onBoneSelected: ((bone: Bone) => void) | null = null;
    public onBoneMoved: ((bone: Bone, position: Point) => void) | null = null;

    constructor(containerId: string, width: number, height: number) {
        this.canvasElement = document.getElementById(containerId) as HTMLElement;
        
        // إنشاء تطبيق PixiJS
        this.app = new PIXI.Application({
            width: width,
            height: height,
            backgroundColor: 0x0f0f1e,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        this.canvasElement.appendChild(this.app.view as HTMLCanvasElement);

        // إنشاء الحاويات
        this.mainContainer = new PIXI.Container();
        this.gridContainer = new PIXI.Container();
        this.bonesContainer = new PIXI.Container();
        this.characterContainer = new PIXI.Container();

        this.app.stage.addChild(this.mainContainer);
        this.mainContainer.addChild(this.gridContainer);
        this.mainContainer.addChild(this.characterContainer);
        this.mainContainer.addChild(this.bonesContainer);

        // رسم الشبكة
        this.drawGrid();

        // إعداد التفاعلات
        this.setupInteractions();

        // التعامل مع تغيير الحجم
        window.addEventListener('resize', () => this.handleResize());
    }

    private drawGrid(): void {
        this.gridContainer.removeChildren();
        
        const gridSize = 50;
        const width = this.app.screen.width;
        const height = this.app.screen.height;
        
        const graphics = new PIXI.Graphics();
        graphics.lineStyle(1, 0x3a3a5c, 0.3);

        // خطوط رأسية
        for (let x = 0; x <= width; x += gridSize) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, height);
        }

        // خطوط أفقية
        for (let y = 0; y <= height; y += gridSize) {
            graphics.moveTo(0, y);
            graphics.lineTo(width, y);
        }

        this.gridContainer.addChild(graphics);
    }

    private setupInteractions(): void {
        // دعم اللمس المتعدد
        let touchStartDistance: number = 0;
        let initialZoom: number = 1;

        this.app.view.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 2) {
                touchStartDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                initialZoom = this.viewport.zoom;
            }
        });

        this.app.view.addEventListener('touchmove', (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const scale = currentDistance / touchStartDistance;
                this.setZoom(initialZoom * scale);
            }
        });

        // عجلة التمرير للتكبير
        this.app.view.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.setZoom(this.viewport.zoom * zoomFactor);
        });
    }

    public setZoom(zoom: number): void {
        this.viewport.zoom = Math.max(0.1, Math.min(5, zoom));
        this.mainContainer.scale.set(this.viewport.zoom);
        this.updateStatus();
    }

    public pan(dx: number, dy: number): void {
        this.viewport.x += dx;
        this.viewport.y += dy;
        this.mainContainer.position.set(this.viewport.x, this.viewport.y);
    }

    public resetView(): void {
        this.viewport = { x: 0, y: 0, zoom: 1 };
        this.mainContainer.position.set(0, 0);
        this.mainContainer.scale.set(1);
        this.updateStatus();
    }

    public toggleGrid(): void {
        this.isGridVisible = !this.isGridVisible;
        this.gridContainer.visible = this.isGridVisible;
    }

    private handleResize(): void {
        const parent = this.canvasElement.parentElement;
        if (parent) {
            this.app.renderer.resize(parent.clientWidth, parent.clientHeight);
            this.drawGrid();
        }
    }

    private updateStatus(): void {
        const zoomLevel = document.getElementById('zoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = Math.round(this.viewport.zoom * 100) + '%';
        }
    }

    // إضافة عظمة للرسم
    public drawBone(start: Point, end: Point, color: number = 0x00ff88, thickness: number = 3): PIXI.Graphics {
        const graphics = new PIXI.Graphics();
        
        // رسم خط العظمة
        graphics.lineStyle(thickness, color, 1);
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(end.x, end.y);

        // رسم المفصل (النقطة الحمراء)
        graphics.beginFill(0xff4757);
        graphics.drawCircle(end.x, end.y, 6);
        graphics.endFill();

        // رسم نقطة البداية
        graphics.beginFill(color);
        graphics.drawCircle(start.x, start.y, 4);
        graphics.endFill();

        this.bonesContainer.addChild(graphics);
        return graphics;
    }

    // إنشاء كائن عظمة تفاعلي
    public createInteractiveBone(bone: Bone): PIXI.Container {
        const container = new PIXI.Container();
        
        const graphics = new PIXI.Graphics();
        const color = parseInt(bone.color.replace('#', '0x'));
        
        // رسم العظمة
        graphics.lineStyle(bone.thickness, color, 1);
        graphics.moveTo(0, 0);
        graphics.lineTo(bone.length, 0);

        // المفصل
        graphics.beginFill(0xff4757);
        graphics.drawCircle(bone.length, 0, 8);
        graphics.endFill();

        // نقطة البداية
        graphics.beginFill(color);
        graphics.drawCircle(0, 0, 5);
        graphics.endFill();

        // جعلها تفاعلية
        graphics.interactive = true;
        graphics.cursor = 'pointer';

        // السحب
        let dragData: PIXI.InteractionData | null = null;
        let dragStart: Point = { x: 0, y: 0 };
        let initialPosition: Point = { x: 0, y: 0 };

        graphics.on('pointerdown', (event: PIXI.InteractionEvent) => {
            dragData = event.data;
            dragStart = dragData.getLocalPosition(container);
            initialPosition = { x: container.x, y: container.y };
            graphics.alpha = 0.8;
            
            if (this.onBoneSelected) {
                this.onBoneSelected(bone);
            }
        });

        graphics.on('pointerup', () => {
            dragData = null;
            graphics.alpha = 1;
        });

        graphics.on('pointerupoutside', () => {
            dragData = null;
            graphics.alpha = 1;
        });

        graphics.on('pointermove', (event: PIXI.InteractionEvent) => {
            if (dragData) {
                const newPosition = dragData.getLocalPosition(container.parent);
                container.x = newPosition.x - dragStart.x;
                container.y = newPosition.y - dragStart.y;
                
                if (this.onBoneMoved) {
                    this.onBoneMoved(bone, { x: container.x, y: container.y });
                }
            }
        });

        container.addChild(graphics);
        container.x = bone.x;
        container.y = bone.y;
        container.rotation = bone.rotation;

        this.bonesContainer.addChild(container);
        return container;
    }

    // مسح جميع العظام
    public clearBones(): void {
        this.bonesContainer.removeChildren();
    }

    // إضافة جزء شخصية
    public addCharacterPart(part: CharacterPart): PIXI.Sprite {
        const sprite = new PIXI.Sprite();
        // هنا يمكن تحميل النصوص الفعلية
        sprite.x = part.x;
        sprite.y = part.y;
        sprite.rotation = part.rotation;
        sprite.scale.set(part.scale);
        sprite.anchor.set(0.5);
        
        this.characterContainer.addChild(sprite);
        return sprite;
    }

    public getApp(): PIXI.Application {
        return this.app;
    }

    public getContainer(): PIXI.Container {
        return this.mainContainer;
    }
}

// واجهات البيانات
interface Bone {
    id: string;
    name: string;
    x: number;
    y: number;
    length: number;
    rotation: number;
    color: string;
    thickness: number;
    parentId?: string;
    type: 'FK' | 'IK';
}

interface CharacterPart {
    id: string;
    type: string;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    texture?: string;
}

// تصدير للاستخدام العام
(window as any).GraphicsEngine = GraphicsEngine;