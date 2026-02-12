/**
 * نظام العظام - Bone System
 * يدعم FK (Forward Kinematics) و IK (Inverse Kinematics)
 */

interface Vector2 {
    x: number;
    y: number;
}

interface BoneData {
    id: string;
    name: string;
    x: number;
    y: number;
    length: number;
    angle: number;
    color: string;
    thickness: number;
    parentId?: string;
    children: string[];
    type: 'FK' | 'IK';
    isSelected: boolean;
}

class BoneSystem {
    private bones: Map<string, BoneData> = new Map();
    private selectedBoneId: string | null = null;
    private engine: GraphicsEngine;
    private boneGraphics: Map<string, PIXI.Container> = new Map();
    
    // إعدادات IK
    private ikIterations: number = 10;
    private ikTolerance: number = 0.1;

    constructor(engine: GraphicsEngine) {
        this.engine = engine;
        this.engine.onBoneSelected = (bone) => this.selectBone(bone.id);
        this.engine.onBoneMoved = (bone, pos) => this.moveBone(bone.id, pos);
    }

    // إنشاء عظمة جديدة
    public createBone(
        name: string,
        x: number,
        y: number,
        length: number,
        angle: number = 0,
        type: 'FK' | 'IK' = 'FK',
        parentId?: string
    ): BoneData {
        const id = 'bone_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const bone: BoneData = {
            id,
            name,
            x,
            y,
            length,
            angle,
            color: '#00ff88',
            thickness: 3,
            parentId,
            children: [],
            type,
            isSelected: false
        };

        this.bones.set(id, bone);

        if (parentId) {
            const parent = this.bones.get(parentId);
            if (parent) {
                parent.children.push(id);
                // حساب الموضع النسبي للأب
                const parentEnd = this.getBoneEnd(parent);
                bone.x = parentEnd.x;
                bone.y = parentEnd.y;
            }
        }

        this.renderBone(bone);
        return bone;
    }

    // رسم العظمة
    private renderBone(bone: BoneData): void {
        const container = new PIXI.Container();
        
        const graphics = new PIXI.Graphics();
        const color = parseInt(bone.color.replace('#', '0x'));
        
        // رسم خط العظمة
        graphics.lineStyle(bone.thickness, color, 1);
        graphics.moveTo(0, 0);
        
        const endX = Math.cos(bone.angle) * bone.length;
        const endY = Math.sin(bone.angle) * bone.length;
        graphics.lineTo(endX, endY);

        // رسم المفصل (نقطة النهاية)
        graphics.beginFill(0xff4757);
        graphics.drawCircle(endX, endY, bone.isSelected ? 10 : 8);
        graphics.endFill();

        // رسم نقطة البداية
        graphics.beginFill(bone.isSelected ? 0xffff00 : color);
        graphics.drawCircle(0, 0, bone.isSelected ? 7 : 5);
        graphics.endFill();

        // إضافة تسمية
        const text = new PIXI.Text(bone.name, {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xffffff,
        });
        text.position.set(5, -20);
        container.addChild(text);

        // جعلها تفاعلية
        graphics.interactive = true;
        graphics.cursor = 'pointer';

        this.setupBoneInteraction(graphics, bone, container);

        container.addChild(graphics);
        container.position.set(bone.x, bone.y);
        
        this.boneGraphics.set(bone.id, container);
        this.engine.getContainer().addChild(container);
    }

    // إعداد تفاعل العظمة
    private setupBoneInteraction(
        graphics: PIXI.Graphics,
        bone: BoneData,
        container: PIXI.Container
    ): void {
        let isDragging = false;
        let dragStart: Vector2 = { x: 0, y: 0 };
        let initialAngle: number = 0;

        graphics.on('pointerdown', (event: PIXI.InteractionEvent) => {
            isDragging = true;
            this.selectBone(bone.id);
            
            const localPos = event.data.getLocalPosition(container);
            dragStart = { x: localPos.x, y: localPos.y };
            initialAngle = bone.angle;

            // تأثير بصري
            graphics.alpha = 0.8;
            gsap.to(container.scale, { x: 1.1, y: 1.1, duration: 0.2 });
        });

        graphics.on('pointerup', () => {
            isDragging = false;
            graphics.alpha = 1;
            gsap.to(container.scale, { x: 1, y: 1, duration: 0.2 });
        });

        graphics.on('pointerupoutside', () => {
            isDragging = false;
            graphics.alpha = 1;
            gsap.to(container.scale, { x: 1, y: 1, duration: 0.2 });
        });

        graphics.on('pointermove', (event: PIXI.InteractionEvent) => {
            if (!isDragging) return;

            const localPos = event.data.getLocalPosition(container.parent);
            
            if (bone.type === 'FK') {
                // Forward Kinematics - تدوير حول نقطة البداية
                const dx = localPos.x - bone.x;
                const dy = localPos.y - bone.y;
                const newAngle = Math.atan2(dy, dx);
                this.setBoneAngle(bone.id, newAngle);
            } else {
                // Inverse Kinematics - تحريك النهاية
                this.solveIK(bone.id, localPos);
            }

            this.updateBoneGraphics(bone.id);
        });
    }

    // حل IK (Cyclic Coordinate Descent)
    private solveIK(boneId: string, target: Vector2): void {
        const bone = this.bones.get(boneId);
        if (!bone) return;

        // بناء سلسلة العظام
        const chain: BoneData[] = [];
        let current: BoneData | undefined = bone;
        
        while (current) {
            chain.unshift(current);
            current = current.parentId ? this.bones.get(current.parentId) : undefined;
        }

        // تكرار CCD
        for (let iter = 0; iter < this.ikIterations; iter++) {
            for (let i = chain.length - 1; i >= 0; i--) {
                const currentBone = chain[i];
                const endEffector = this.getChainEnd(chain);
                
                if (this.distance(endEffector, target) < this.ikTolerance) {
                    return;
                }

                // حساب الزاوية المثلى
                const toTarget = this.normalize({
                    x: target.x - currentBone.x,
                    y: target.y - currentBone.y
                });
                
                const toEnd = this.normalize({
                    x: endEffector.x - currentBone.x,
                    y: endEffector.y - currentBone.y
                });

                const cross = toTarget.x * toEnd.y - toTarget.y * toEnd.x;
                const dot = toTarget.x * toEnd.x + toTarget.y * toEnd.y;
                
                let angleDiff = Math.atan2(cross, dot);
                currentBone.angle += angleDiff;

                this.updateBonePosition(currentBone);
            }
        }
    }

    // الحصول على نهاية السلسلة
    private getChainEnd(chain: BoneData[]): Vector2 {
        const lastBone = chain[chain.length - 1];
        return this.getBoneEnd(lastBone);
    }

    // حساب نهاية العظمة
    private getBoneEnd(bone: BoneData): Vector2 {
        return {
            x: bone.x + Math.cos(bone.angle) * bone.length,
            y: bone.y + Math.sin(bone.angle) * bone.length
        };
    }

    // تحديث موضع العظمة وأبنائها
    private updateBonePosition(bone: BoneData): void {
        if (bone.parentId) {
            const parent = this.bones.get(bone.parentId);
            if (parent) {
                const parentEnd = this.getBoneEnd(parent);
                bone.x = parentEnd.x;
                bone.y = parentEnd.y;
            }
        }

        // تحديث الأبناء
        bone.children.forEach(childId => {
            const child = this.bones.get(childId);
            if (child) {
                this.updateBonePosition(child);
            }
        });
    }

    // تحديث الرسم البياني للعظمة
    private updateBoneGraphics(boneId: string): void {
        const bone = this.bones.get(boneId);
        const container = this.boneGraphics.get(boneId);
        
        if (!bone || !container) return;

        container.position.set(bone.x, bone.y);
        container.rotation = bone.angle;

        // إعادة رسم العظمة
        container.removeChildren();
        this.renderBone(bone);
    }

    // تحريك عظمة
    public moveBone(boneId: string, position: Vector2): void {
        const bone = this.bones.get(boneId);
        if (!bone) return;

        const dx = position.x - bone.x;
        const dy = position.y - bone.y;

        bone.x = position.x;
        bone.y = position.y;

        // تحريك الأبناء نسبياً
        this.moveChildren(bone, dx, dy);
        this.updateBoneGraphics(boneId);
    }

    private moveChildren(bone: BoneData, dx: number, dy: number): void {
        bone.children.forEach(childId => {
            const child = this.bones.get(childId);
            if (child) {
                child.x += dx;
                child.y += dy;
                this.moveChildren(child, dx, dy);
                this.updateBoneGraphics(childId);
            }
        });
    }

    // تدوير عظمة
    public setBoneAngle(boneId: string, angle: number): void {
        const bone = this.bones.get(boneId);
        if (!bone) return;

        bone.angle = angle;
        this.updateBonePosition(bone);
        
        // تحديث جميع الرسومات
        this.bones.forEach((b, id) => {
            this.updateBoneGraphics(id);
        });
    }

    // اختيار عظمة
    public selectBone(boneId: string | null): void {
        // إلغاء الاختيار السابق
        if (this.selectedBoneId) {
            const prevBone = this.bones.get(this.selectedBoneId);
            if (prevBone) {
                prevBone.isSelected = false;
                this.updateBoneGraphics(this.selectedBoneId);
            }
        }

        this.selectedBoneId = boneId;
        
        if (boneId) {
            const bone = this.bones.get(boneId);
            if (bone) {
                bone.isSelected = true;
                this.updateBoneGraphics(boneId);
                this.emit('boneSelected', bone);
            }
        }
    }

    // حذف عظمة
    public deleteBone(boneId: string): void {
        const bone = this.bones.get(boneId);
        if (!bone) return;

        // حذف من قائمة أبناء الأب
        if (bone.parentId) {
            const parent = this.bones.get(bone.parentId);
            if (parent) {
                parent.children = parent.children.filter(id => id !== boneId);
            }
        }

        // حذف الأبناء بشكل متكرر
        bone.children.forEach(childId => this.deleteBone(childId));

        // حذف الرسم
        const container = this.boneGraphics.get(boneId);
        if (container) {
            container.destroy();
        }

        this.bones.delete(boneId);
        this.boneGraphics.delete(boneId);

        if (this.selectedBoneId === boneId) {
            this.selectedBoneId = null;
        }
    }

    // الحصول على جميع العظام
    public getAllBones(): BoneData[] {
        return Array.from(this.bones.values());
    }

    // الحصول على عظمة محددة
    public getBone(id: string): BoneData | undefined {
        return this.bones.get(id);
    }

    // مسح الكل
    public clear(): void {
        this.bones.forEach((bone, id) => {
            const container = this.boneGraphics.get(id);
            if (container) container.destroy();
        });
        this.bones.clear();
        this.boneGraphics.clear();
        this.selectedBoneId = null;
    }

    // أدوات مساعدة
    private distance(a: Vector2, b: Vector2): number {
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    private normalize(v: Vector2): Vector2 {
        const len = Math.hypot(v.x, v.y);
        return len > 0 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
    }

    // إرسال أحداث
    private emit(event: string, data: any): void {
        const customEvent = new CustomEvent(event, { detail: data });
        window.dispatchEvent(customEvent);
    }
}

// تصدير
(window as any).BoneSystem = BoneSystem;