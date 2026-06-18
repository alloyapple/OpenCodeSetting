export namespace main {
	
	export class BackupInfo {
	    name: string;
	    path: string;
	    created: string;
	
	    static createFrom(source: any = {}) {
	        return new BackupInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.created = source["created"];
	    }
	}

}

